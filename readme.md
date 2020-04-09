# ReactNativeWebRTC + Socket.io Server

## Configuration (Works on iOS & Android)
**react: 16.11.0**

**react-native: 0.62.2**

**react-native-webrtc: 1.75.3**

## Usage
- Clone the repository, run `npm install` OR `yarn`.  
- For iOS, run the project on Xcode.  
- For Android, run `react-native run-android` in the directory.  

## Native Code Changes (*Android* & *iOS*)
- Because the RN version is **0.62.2** and is **>0.60.0** therefore supports autolinking in android so you don't need to do anything. For further guidelines on linking the webrtc module, you can refer to the official docs of **react-native-webrtc**:

- Android: https://github.com/react-native-webrtc/react-native-webrtc/blob/master/Documentation/AndroidInstallation.md

- iOS: https://github.com/react-native-webrtc/react-native-webrtc/blob/master/Documentation/iOSInstallation.md 

## Instructions
- For this to work you need to start the server:
```terminal
cd server
node index.js OR nodemon index.js OR nodemon (if nodemon is installed)
```

## Ngrok
- download: [ngrok](https://ngrok.com/)
- install
- login

- After you create the server and deploy it with ngrok copy the link, something like that "https://a4cd7858.ngrok.io" and paste it to ```RCTWebRCTDemo2/src/App.js``` 
```javascript
const url = 'paste_it_here';
```
- It must look like than
```javascript
const url = 'https://a4cd7858.ngrok.io/';
```

# Note 
- Whenever you change the ngrok link you must follow the same routine. 