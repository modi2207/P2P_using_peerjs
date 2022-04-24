import { Component, ElementRef, Injectable, ViewChild } from '@angular/core';
import { FormBuilder, Validators , FormGroup} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { client, xml } from '@xmpp/client'
import { HtmlParser } from '@angular/compiler';
import {MainService} from './service/ms.service'
declare var Peer: any;
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

@Injectable({
  providedIn: 'root'
})

export class AppComponent {
 localStream:any
 title = 'Chatapp';
 public MediaConnection: {[JID:string]:any}={}
 public PID:any
 public peer:any;
 public jidr:string=''
 public jidl:string=''
 public xmpp:any
 public from:string=''
 public myJID:string=''
 public password:string=''
 public PCConnection:RTCPeerConnection[]=[]
 public connectedPeerID:any[]=[]
 public currentlyCallingPeers:any[]=[]
 public callAccepted:boolean=false 
 public messageRecived:any
 public constraints = {audio: true, video: true};
 public configuration = {iceServers: [ {
  urls: 'turn:192.241.130.220:3478', 
  username: 'bozu', 
  credential: 'bozu@123'
}]};


  constructor(
  public http:HttpClient,
  public roomClient:MainService
  )
  {  }

 public async Register()
 {
      let username=((document.getElementById("userreg") as HTMLInputElement).value)
      let password=((document.getElementById("pwdreg") as HTMLInputElement).value)
      let data = {
        "user": username,
        "host": "localhost",
        "password": password
      }
      const headers = { 
      'Authorization': 'Bearer Fbgpm0QlFaL5HHnMpLXSm1p8GJT73Z0T',
      'Access-Control-Allow-Origin': "*"
      };
      this.http.post('https://romu.us:5443/api/register',data,{headers}).subscribe(data => {
        console.log("Data : "+data)
        this.jidr=username+"@localhost"
    });
 }

  public async Login()
  {
      this.myJID=((document.getElementById("userlog") as HTMLInputElement).value)
      this.PID=this.myJID.slice(0,this.myJID.indexOf('@'))
      console.log("this.pid: "+this.PID)
      this.password=((document.getElementById("pwdlog") as HTMLInputElement).value)
      this.xmpp = client({ service: 'wss://romu.us:5443/ws', domain: 'localhost', username: this.myJID, resource:this.myJID ,password: this.password});
      this.xmpp.start().catch(console.error)   
      await this.createPeer()  
      this.xmpp.on('online',(data:any)=>
      {
            console.log("you are online")
            this.xmpp.send(xml("presence"));
            this.jidl="jid:"+this.myJID
        
      })
      
      this.xmpp.on("stanza",  async (stanza:any) => {
              if(stanza.is('presence'))
              {
                console.log("stanza called")
              } 
              else if (stanza.is("message")) {
                  
                   console.log("message called")
                   let Data=JSON.parse(stanza.getChild("body").text())

                   if(Data.tos==='chatMessage')
                  {
                      console.log("chat message recived")
                      console.log(stanza.getChild("body").text())
                      this.messageRecived=Data.message
                        // this.messageRecived=stanza.getChild("body").text()
                         this.from=stanza.attrs.from
                         this.from=this.from.split('@')[0]
                         console.log("inside message: "+stanza.getChild("body").text())
                         console.log(stanza.getChild("body").text())
                  }
                  else if(Data.tos==='AddRequest')
                  {
                    this.initiateWebrtc(Data.addedJID)
                  }
                  else if(Data.tos==='callRequest')
                  {
                    let res:any
                    let callAudio = <HTMLAudioElement>document.getElementById('callAudio');
                    let confirmAction 
                    callAudio.src="../assets/ringtone.mp3"
                    await callAudio.load() 
                    await callAudio.play() 
                    setTimeout(() => {
                      confirmAction=null
                     if(!(res==='accept' || res==='reject'))
                     {
                      let jsonReponseData={
                        "tos":"callResponse",
                        "result":'none',
                        "to":Data.from,
                        "from":Data.to
                      }
                      const responseCallMessage = xml(
                        "message",
                        { type: "chat", to: Data.from },
                        xml("body", {},JSON.stringify(jsonReponseData)))
                      this.xmpp.send(responseCallMessage)
                     }
                    }, 10000);
                   
                    let date = new Date();  
                    //console.log(date.getTime());
                    console.log("ring end time: "+date.getTime())
                       
                        console.log("request recived successfully")
                        let callingPeer=Data.from
                         confirmAction = confirm(callingPeer+" is calling you, what would you do? ")
                        if(confirmAction)
                        {
                            res="accept"
                            this.callAccepted=true
                            await callAudio.pause()
                            await this.passJIDToOtherPeers(Data.from) 
                        }
                        else{
                            res="reject"
                            this.callAccepted=false
                            await callAudio.pause()
                        }
                        let jsonReponseData={
                          "tos":"callResponse",
                          "result":res,
                          "to":Data.from,
                          "from":Data.to
                        }
                        const responseCallMessage = xml(
                          "message",
                          { type: "chat", to: Data.from },
                          xml("body", {},JSON.stringify(jsonReponseData)))
                        this.xmpp.send(responseCallMessage)
                  }
                  else if(Data.tos==='endCall')
                  {
                        this.connectedPeerID.splice(this.connectedPeerID.indexOf(Data.from),1)
                        if(this.MediaConnection[Data.from])
                        await this.MediaConnection[Data.from].close()
                        this.MediaConnection[Data.from]=undefined
                        console.log(this.connectedPeerID.length)
                        if(this.connectedPeerID.length===0){
                        console.log("inside connectpeerid zero")
                        if(this.localStream){
                        this.localStream.getTracks().forEach((track:any) => track.stop());
                        this.localStream = null;
                        }
                        }
                        if(this.roomClient.remoteStream[Data.from]){
                        this.roomClient.remoteStream[Data.from].getTracks().forEach((track:any) => track.stop());
                        this.roomClient.remoteStream[Data.from] = undefined;
                        }
                  }
                  else if(Data.tos==='callResponse')
                  {
                       if(Data.result==='accept')
                       {
                          this.callAccepted=true
                          await this.passJIDToOtherPeers(Data.from) 
                          this.initiateWebrtc(Data.from)
                       }
                       else if(Data.result==='reject')
                       {
                           this.callAccepted=false
                       }
                        let i=this.currentlyCallingPeers.indexOf(Data.from)
                        if(i!=-1)
                        this.currentlyCallingPeers.splice(i,1)
                  }
              }
      })
      this.xmpp.on("error",(error:any)=> console.log("something wrong happerned: ",error))
      this.xmpp.on("offline",(date:any)=>
      {
          console.log("client is offline")
      })

  
  }

  public async passJIDToOtherPeers(calleeJID:any)
{
    for(let jid in this.connectedPeerID)
    {
      console.log("other jid: "+this.connectedPeerID[jid])
      let jsonCallData={
        "tos":"AddRequest",
        "to":this.connectedPeerID[jid],
        "from":this.myJID,
        "addedJID":calleeJID
      }  
      const requestToADDPeer = xml(
        "message",
        { type: "chat", to: this.connectedPeerID[jid] },
        xml("body", {},JSON.stringify(jsonCallData)))
      await this.xmpp.send(requestToADDPeer)
    }
}
  public async createPeer()
  {
    console.log("inside create peer")
    this.peer=new Peer(this.PID,{
      config: {iceServers: [ {
        urls: 'turn:192.241.130.220:3478', 
        username: 'bozu', 
        credential: 'bozu@123'
      }]} /* Sample servers, please use appropriate ones */
      })
     console.log("peer--> ",this.peer)
      this.peer.on('open', (id:any)=> {
        console.log('My peer ID is: ' + id);
       //this.connectID=id;
        });
      this.peer.on('call', async (call:any)=> {
        await this.onVideoStream()
        let id=call.peer+'@localhost';
        if(!this.MediaConnection[id])
        this.MediaConnection[id]=call
        console.log("inside on call")
        // Answer the call, providing our mediaStream
        call.answer(this.localStream);
        
        call.on('stream',(stream:any)=>
        {
            if(!this.roomClient.remoteStream[id]){
            console.log("kind: "+stream.getVideoTracks()[0].kind)   
            this.roomClient.remoteStream[id]=stream
            this.connectedPeerID.push(id);
            }
            console.log("remote stream recieved")
        })
        });
      //this.peer.on()
  }
  public async initiateWebrtc(JID:string)
  {
    await this.onVideoStream()
    console.log("mediaconnectionpeerid: "+this.MediaConnection[JID])
    let pid=JID.slice(0,JID.indexOf('@'));
    console.log("jid: "+JID)
    if(!this.MediaConnection[JID])
    {
     this.MediaConnection[JID] = await this.peer.call(pid,this.localStream);   
    }
  
    this.MediaConnection[JID].on('stream',(stream:any)=>
    {
      if(!this.roomClient.remoteStream[JID]){
      console.log("getting remote stream")
      this.roomClient.remoteStream[JID]=stream
      this.connectedPeerID.push(JID)
      }
    })
  }

  public async onVideoStream()
  {
    try {
      let localVideo = <HTMLVideoElement>document.getElementById('localVideo');
      const stream =
        await navigator.mediaDevices.getUserMedia(this.constraints);
        this.localStream=stream 
        localVideo.srcObject=stream 
    } catch (err) {
        console.error("error in createpeerconnection: "+err);
    }
  }
  public async startcall()
  {
      
        let otherJID=((document.getElementById("jid") as HTMLInputElement).value)
        if(this.currentlyCallingPeers.indexOf(otherJID)!==-1 || this.connectedPeerID.indexOf(otherJID)!==-1)
        return
        let date=new Date()
        console.log("ring start time: "+ date.getTime())
        this.currentlyCallingPeers.push(otherJID)
       // console.log("this from: "+this.from)
        let jsonCallData={
          "tos":"callRequest",
          "to":otherJID,
          "from":this.myJID
        }  
        const requestCallMessage = xml(
          "message",
          { type: "chat", to: otherJID },
          xml("body", {},JSON.stringify(jsonCallData)))
        this.xmpp.send(requestCallMessage)
  }
  public async stopcall()
  {
    for(let i in this.MediaConnection)
     { 
         if(this.MediaConnection[i])
         await this.MediaConnection[i].close();
         this.MediaConnection[i] = undefined;
     } 
    // await this.MediaConnection.close()
     if(this.localStream)
     this.localStream.getTracks().forEach((track:any) => track.stop());
     this.localStream = null;
     for(let i in this.roomClient.remoteStream)
     {
      if(this.roomClient.remoteStream[i])
      this.roomClient.remoteStream[i].getTracks().forEach((track:any) => track.stop());
      this.roomClient.remoteStream[i] = undefined;
     }
     for(let i in this.connectedPeerID)
     {
         console.log("connector id: "+this.connectedPeerID[i])
            let jsonCallData={
              "tos":"endCall",
              "to":this.connectedPeerID[i],
              "from":this.myJID
            }  
            const EndMessage = xml(
              "message",
              { type: "chat", to: this.connectedPeerID[i] },
              xml("body", {},JSON.stringify(jsonCallData)))
            this.xmpp.send(EndMessage)
            
      }
      this.connectedPeerID.splice(0,this.connectedPeerID.length)
    
  }
  public send()
  {
    let jid=((document.getElementById("peerid") as HTMLInputElement).value)
    let msg=((document.getElementById("message") as HTMLInputElement).value)
    let msgjson={
      "message":msg,
      "tos":'chatMessage'
    }
    console.log("jid: "+jid+"msg: "+msg)
    const message = xml(
      "message",
      { type: "groupchat", to: jid },
      xml("body", {},JSON.stringify(msgjson)))
      this.xmpp.send(message)
  }
  public Logout()
  {
      if(this.xmpp)
      {
        this.jidl=''
        this.xmpp.stop().catch(console.error);
      }
  }
}