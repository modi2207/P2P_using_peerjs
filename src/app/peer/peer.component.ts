import { nullSafeIsEquivalent } from '@angular/compiler/src/output/output_ast';
import { Component, ElementRef, Input, OnInit, QueryList, ViewChildren } from '@angular/core';
import { MainService } from '../service/ms.service';
@Component({
  selector: 'app-peer',
  templateUrl: './peer.component.html',
  styleUrls: ['./peer.component.scss']
})
export class PeerComponent implements OnInit {

  @Input() jid:string=''
  @ViewChildren('videoPlayer')
  videoEle!: QueryList<ElementRef>;

  videoPlayer!: ElementRef;

  constructor(public roomClient:MainService) { 
    
  }

  ngOnInit(): void {
  }

  ngAfterViewInit() {
    if(this.videoEle.first)
    {
         this.videoPlayer=this.videoEle.first
         this.setVideoTrack()
    }
  }

  setVideoTrack()
  {
    if(this.roomClient.remoteStream[this.jid]){
     this.videoPlayer.nativeElement.srcObject=this.roomClient.remoteStream[this.jid]
    }
  }
}
