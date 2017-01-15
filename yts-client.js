/**
 * Created by aldiraraharja on 1/15/17.
 */
'use strict';

const Promise = require('bluebird');
const unirest = require('unirest');

const OK = 'ok';
const ERROR = 'error';

class YtsClient {

    listMovie(limit, page, quality, minimum_rating, query_term, genre, sort_by, order_by, with_rt_ratings) {
        return this._get('list_movies', {
            limit, page, quality, minimum_rating, query_term, genre, sort_by, order_by, with_rt_ratings
        });
    }

    movieDetails(movie_id, with_images, with_cast) {
        return this._get('movie_details', {
            movie_id, with_images, with_cast
        });
    }

    listUpcoming() {
        return this._get('list_upcoming');
    }

    _get(endpoint, query) {
        return new Promise((resolve, reject) => {
            unirest.get(`${BASE_URL}${endpoint}.json`)
                .query(query)
                .end((response) => {
                    const responseData = response.body;
                    if (responseData.status === ERROR) {
                        return reject(responseData.status_message);
                    }
                    resolve(responseData.data);
                })
        });
    }

    _post(endpoint, payload) {
        return new Promise((resolve, reject) => {
            unirest.post(`${BASE_URL}${endpoint}.json`)
                .send(payload)
                .end((response) => {
                    const responseData = response.body;
                    if (responseData.status === ERROR) {
                        return reject(responseData.status_message);
                    }
                    resolve(responseData.data);
                })
        });
    }
}

module.exports = YtsClient;