import React, { Component } from 'react';

class WatchPage extends Component {

  constructor(props) {
    super(props);
  }

  render() {
    return (
      <div>
        <video src={`/data/${this.props.match.params.id}`} />
      </div>
    );
  }
}

export default WatchPage;
