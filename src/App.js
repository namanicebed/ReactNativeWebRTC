import React, {Component} from 'react';
import {Text, TouchableOpacity, View, YellowBox} from 'react-native';
import {
  mediaDevices,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCView,
} from 'react-native-webrtc';
import io from 'socket.io-client';
import {button, container, rtcView, text} from './styles';
import log from './debug/log';
import logError from './debug/logError';

YellowBox.ignoreWarnings([
  'Setting a timer',
  'Unrecognized WebSocket connection',
  'ListView is deprecated and will be removed',
]);

/* ==============================
 Global variables
 ================================ */
const url = 'http://7308650c.ngrok.io';
const socket = io.connect(url, {transports: ['websocket']});
const configuration = {iceServers: [{urls: 'stun:stun.l.google.com:19302'}]};

let pcPeers = {};
let appClass;
let localStream;

/* ==============================
 Class
 ================================ */
class App extends Component {
  state = {
    info: 'Initializing',
    status: 'init',
    roomID: 'myroom',
    isFront: true,
    streamURL: null,
    remoteList: {},
  };

  componentDidMount() {
    appClass = this;

    getLocalStream();
  }

  switchCamera = () => {
    localStream.getVideoTracks().forEach((track) => {
      track._switchCamera();
    });
  };

  onPress = () => {
    this.setState({
      status: 'connect',
      info: 'Connecting',
    });

    join(this.state.roomID);
  };

  button = (func, text) => (
    <TouchableOpacity style={button.container} onPress={func}>
      <Text style={button.style}>{text}</Text>
    </TouchableOpacity>
  );

  render() {
    const {status, info, streamURL, remoteList} = this.state;

    return (
      <View style={container.style}>
        <Text style={text.style}>{info}</Text>

        {status === 'ready' ? this.button(this.onPress, 'Enter room') : null}
        {this.button(this.switchCamera, 'Change Camera')}

        <RTCView streamURL={streamURL} style={rtcView.style} />

        {mapHash(remoteList, (remote, index) => {
          return (
            <RTCView key={index} streamURL={remote} style={rtcView.style} />
          );
        })}
      </View>
    );
  }
}

/* ==============================
 Functions
 ================================ */
const getLocalStream = () => {
  let isFront = true;

  // let constrains = {
  //   audio: false,
  //   video: {
  //     mandatory: {
  //       minWidth: 640,
  //       minHeight: 360,
  //       minFrameRate: 30,
  //     },
  //     facingMode: isFront ? 'user' : 'environment',
  //   },
  // };
  // let getStream = stream => {
  //   localStream = stream;

  // appClass.setState({
  //   streamURL: stream.toURL(),
  //   status: 'ready',
  //   info: 'Welcome to WebRTC demo',
  // });
  // };

  // getUserMedia(constrains, getStream, logError);
  mediaDevices.enumerateDevices().then((sourceInfos) => {
    // console.log(sourceInfos);
    let videoSourceId;
    for (let i = 0; i < sourceInfos.length; i++) {
      const sourceInfo = sourceInfos[i];
      if (
        sourceInfo.kind == 'videoinput' &&
        sourceInfo.facing == (isFront ? 'front' : 'environment')
      ) {
        videoSourceId = sourceInfo.deviceId;
      }
    }
    mediaDevices
      .getUserMedia({
        audio: true,
        video: {
          mandatory: {
            minWidth: 500, // Provide your own width, height and frame rate here
            minHeight: 300,
            minFrameRate: 30,
          },
          facingMode: isFront ? 'user' : 'environment',
          optional: videoSourceId ? [{sourceId: videoSourceId}] : [],
        },
      })
      .then((stream) => {
        // Got stream!
        localStream = stream;
        appClass.setState({
          streamURL: stream.toURL(),
          status: 'ready',
          info: 'Welcome to WebRTC demo',
        });
      })
      .catch((error) => {
        // Log error
      });
  });
};

const join = (roomID) => {
  let onJoin = (socketIds) => {
    for (const i in socketIds) {
      if (socketIds.hasOwnProperty(i)) {
        const socketId = socketIds[i];
        createPC(socketId, true);
      }
    }
  };

  socket.emit('join', roomID, onJoin);
};

const createPC = (socketId, isOffer) => {
  /**
   * Create the Peer Connection
   */
  const peer = new RTCPeerConnection(configuration);

  // log('Peer', peer);

  pcPeers = {
    ...pcPeers,
    [socketId]: peer,
  };

  /**
   * On Negotiation Needed
   */
  peer.onnegotiationneeded = async () => {
    // console.log('onnegotiationneeded');
    if (isOffer) {
      try {
        await peer.setLocalDescription(await peer.createOffer());
        // send the offer to the other peer
        socket.emit('exchange', {
          to: socketId,
          sdp: peer.localDescription,
          type: 'offer',
        });
      } catch (err) {
        console.error(err);
      }
      // let callback = async (desc) => {
      //   log('The SDP offer', desc.sdp);

      //   await peer.setLocalDescription(desc);
      //   callback2();
      // };
      // let callback2 = () => {
      //   //console.log('setLocalDescription', peer.localDescription);
      //   socket.emit('exchange', {to: socketId, sdp: peer.localDescription});
      // };

      // await peer.createOffer(callback, logError);
    }
  };

  /**
   * (Deprecated)
   */
  peer.addStream(localStream);

  /**
   * On Add Stream (Deprecated)
   */
  peer.onaddstream = (event) => {
    //console.log('onaddstream', event.stream);
    const remoteList = appClass.state.remoteList;

    remoteList[socketId] = event.stream.toURL();
    appClass.setState({
      info: 'One peer join!',
      remoteList: remoteList,
    });
  };

  /**
   * On Ice Candidate
   */
  peer.onicecandidate = (event) => {
    //console.log('onicecandidate', event.candidate);
    if (event.candidate) {
      socket.emit('exchange', {to: socketId, candidate: event.candidate});
    }
  };

  /**
   * On Ice Connection State Change
   */
  peer.oniceconnectionstatechange = (event) => {
    //console.log('oniceconnectionstatechange', event.target.iceConnectionState);
    if (event.target.iceConnectionState === 'completed') {
      //console.log('event.target.iceConnectionState === 'completed'');
      setTimeout(() => {
        getStats();
      }, 1000);
    }
    if (event.target.iceConnectionState === 'connected') {
      //console.log('event.target.iceConnectionState === 'connected'');
    }
  };

  /**
   * On Signaling State Change
   */
  peer.onsignalingstatechange = (event) => {
    //console.log('on signaling state change', event.target.signalingState);
  };

  /**
   * On Remove Stream
   */
  peer.onremovestream = (event) => {
    //console.log('on remove stream', event.stream);
  };

  return peer;
};

socket.on('connect', () => {
  //console.log('connect');
});
socket.on('exchange', (data) => {
  exchange(data);
});
socket.on('leave', (socketId) => {
  leave(socketId);
});

const exchange = async (data) => {
  let fromId = data.from;

  if (data.sdp) {
    log('Exchange', data);
  }

  let peer;
  if (fromId in pcPeers) {
    peer = pcPeers[fromId];
  } else {
    peer = createPC(fromId, false);
  }

  if (data.sdp) {
    //console.log('exchange sdp', data);
    let sdp = new RTCSessionDescription(data.sdp);

    // let callback = () =>
    //   peer.remoteDescription.type === 'offer'
    //     ? peer.createAnswer(callback2, logError)
    //     : null;
    // let callback2 = (desc) =>
    //   peer.setLocalDescription(desc, callback3, logError);
    // let callback3 = () =>
    //   socket.emit('exchange', {to: fromId, sdp: peer.localDescription});

    // peer.setRemoteDescription(sdp, callback, logError);
    if (data.type == 'offer') {
      await peer.setRemoteDescription(sdp);
      await peer.setLocalDescription(await peer.createAnswer());
      socket.emit('exchange', {to: fromId, sdp: peer.localDescription,type:'answer'});
    } else if (data.type == 'answer') {
      await peer.setRemoteDescription(sdp);
    }
  } else {
    peer.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
};

const leave = (socketId) => {
  //console.log('leave', socketId);

  const peer = pcPeers[socketId];

  peer.close();

  delete pcPeers[socketId];

  const remoteList = appClass.state.remoteList;

  delete remoteList[socketId];

  appClass.setState({
    info: 'One peer left!',
    remoteList: remoteList,
  });
};

const mapHash = (hash, func) => {
  //console.log(hash);
  const array = [];
  for (const key in hash) {
    if (hash.hasOwnProperty(key)) {
      const obj = hash[key];
      array.push(func(obj, key));
    }
  }
  return array;
};

const getStats = () => {
  const pc = pcPeers[Object.keys(pcPeers)[0]];
  if (
    pc.getRemoteStreams()[0] &&
    pc.getRemoteStreams()[0].getAudioTracks()[0]
  ) {
    const track = pc.getRemoteStreams()[0].getAudioTracks()[0];
    let callback = (report) => console.log('getStats report', report);

    //console.log('track', track);

    pc.getStats(track, callback, logError);
  }
};

/* ==============================
 Export
 ================================ */
export default App;
