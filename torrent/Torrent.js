const Webtorrent = require('webtorrent');
const pump = require('pump');
const mime = require('mime');
const rangeParser = require('range-parser');
const admin = require("firebase-admin");
const firestore = admin.firestore();
const _ = require('lodash');

const webtorrent = new Webtorrent();
const listTorrent = {}

// From https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent
function encodeRFC5987 (str) {
    return encodeURIComponent(str)
      // Note that although RFC3986 reserves "!", RFC5987 does not,
      // so we do not need to escape it
      .replace(/['()]/g, escape) // i.e., %27 %28 %29
      .replace(/\*/g, '%2A')
      // The following are not required for percent-encoding per RFC5987,
      // so we can allow for a little better readability over the wire: |`^
      .replace(/%(?:7C|60|5E)/g, unescape)
  }

class Torrent {
  
    constructor() {
        firestore.collection('session')
            .onSnapshot(snapshot => {
                snapshot.docChanges.forEach(change => {
                  const torrentUrl = change.doc.data().torrentUrl;
                  if (change.type === 'added' && !listTorrent[torrentUrl]) {
                    this.addNewTorrent(change.doc.id, torrentUrl);
                  }
                });
            });
        
        webtorrent.on('error', err => {
          console.log(err);
        });

        setInterval(this.expiredTorrent, 3600 * 1000);
    }

    expiredTorrent() {
      console.log(`Destroying old torrent`);
      const expiredDate = new Date();
      expiredDate.setHours(expiredDate.getHours-3);
      _.keys(listTorrent).forEach(url => {
        const torr = listTorrent[url];
        if (torr.date < expiredDate.getTime()) {
          //  torr is not accessed in last 3 hours
          torr.torrent.destroy(() => {
            console.log(`torrent ${url} is destroyed`);
            delete listTorrent[url];
          });
        }
      });
    }

    addNewTorrent(sessionId, torrentFile) {
      if (listTorrent[torrentFile]) {
        return this.notifySessionReady(sessionId);
      }
      webtorrent.add(torrentFile, (torrent) => {
            console.log(`Torrent for ${sessionId} is available`);
            const date = new Date();
            listTorrent[torrentFile] = {
              torrent,
              date: date.getTime(),
            };
            this.notifySessionReady(sessionId);
        });
    }

    notifySessionReady(sessionId) {
      firestore.doc(`/session/${sessionId}`).update({
        status: 'ready',
      }).then(() => {
        console.log(`URL ${sessionId} is ready`);
      })
    }

    serveFile(req, res) {
        firestore.doc(`session/${req.parmas.id}`).get()
          .then(snapshot => {
            const sessionData = snapshot.data();
            if (!listTorrent[sessionData.torrentUrl]) {
              return res.sendStatus(404);
          }
            const currentTime = new Date();
            listTorrent[sessionData.torrentUrl].date = currentTime.getTime();
            const file = _.orderBy(listTorrent[sessionData.torrentUrl].torrent.files, ['length'], ['desc'])[0];
            res.statusCode = 200
            res.setHeader('Content-Type', mime.lookup(file.name))
      
            // Support range-requests
            res.setHeader('Accept-Ranges', 'bytes')
      
            // Set name of file (for "Save Page As..." dialog)
            res.setHeader(
              'Content-Disposition',
              'inline; filename*=UTF-8\'\'' + encodeRFC5987(file.name)
            )
      
            // Support DLNA streaming
            res.setHeader('transferMode.dlna.org', 'Streaming')
            res.setHeader(
              'contentFeatures.dlna.org',
              'DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01700000000000000000000000000000'
            )
      
            // `rangeParser` returns an array of ranges, or an error code (number) if
            // there was an error parsing the range.
            var range = rangeParser(file.length, req.headers.range || '')
      
            if (Array.isArray(range)) {
              res.statusCode = 206 // indicates that range-request was understood
      
              // no support for multi-range request, just use the first range
              range = range[0]
      
              res.setHeader(
                'Content-Range',
                'bytes ' + range.start + '-' + range.end + '/' + file.length
              )
              res.setHeader('Content-Length', range.end - range.start + 1)
            } else {
              range = null
              res.setHeader('Content-Length', file.length)
            }
      
            if (req.method === 'HEAD') {
              return res.end()
            }
      
            pump(file.createReadStream(range), res)
          });
      }
}

module.exports = Torrent;