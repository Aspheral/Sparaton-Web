import { DurableObject } from 'cloudflare:workers';
import type { Env } from './env';

type SocketAttachment={ role:'client'|'staff'; participant:string };

export class TicketRoom extends DurableObject<Env> {
  async fetch(request:Request):Promise<Response>{
    const url=new URL(request.url);
    if (url.pathname.endsWith('/connect')) {
      if (request.headers.get('Upgrade')!=='websocket') return new Response('Expected websocket',{status:426});
      const role=request.headers.get('x-sparaton-role')==='staff'?'staff':'client';
      const participant=request.headers.get('x-sparaton-participant')??'unknown';
      const pair=new WebSocketPair();
      const client=pair[0]; const server=pair[1];
      server.serializeAttachment({role,participant} satisfies SocketAttachment);
      this.ctx.acceptWebSocket(server,[role]);
      this.broadcast({type:'presence',role,online:true},server);
      return new Response(null,{status:101,webSocket:client});
    }
    if (url.pathname.endsWith('/presence')) {
      return Response.json({ clients:this.ctx.getWebSockets('client').length, staff:this.ctx.getWebSockets('staff').length });
    }
    if (url.pathname.endsWith('/broadcast') && request.method==='POST') {
      const payload=await request.json<unknown>();
      this.broadcast(payload);
      return Response.json({ delivered:this.ctx.getWebSockets().length });
    }
    return new Response('Not found',{status:404});
  }

  async webSocketMessage(ws:WebSocket,message:string|ArrayBuffer){
    if (typeof message!=='string') return;
    let payload:unknown;
    try { payload=JSON.parse(message); } catch { return; }
    if (typeof payload==='object' && payload && 'type' in payload && (payload as {type?:string}).type==='typing') this.broadcast(payload,ws);
  }

  async webSocketClose(ws:WebSocket,code:number,reason:string){
    const attachment=ws.deserializeAttachment() as SocketAttachment|null;
    if (attachment) this.broadcast({type:'presence',role:attachment.role,online:false},ws);
    ws.close(code,reason);
  }

  private broadcast(payload:unknown,except?:WebSocket){
    const data=JSON.stringify(payload);
    for (const socket of this.ctx.getWebSockets()) if (socket!==except && socket.readyState===WebSocket.OPEN) socket.send(data);
  }
}
