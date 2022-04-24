import { Injectable } from '@angular/core';


declare var $: any

@Injectable({
    providedIn: 'root'
})
export class MainService {

    public remoteStream: {[JID:string]:any}={}

    constructor(
     
    ) { }

    
   
    
}
