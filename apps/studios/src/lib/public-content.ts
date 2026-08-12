export const API_ORIGIN='https://api.sparaton.com';

export async function fetchContent(kind:'projects'|'posts'|'people'|'organizations'|'services',slug:string){
  const response=await fetch(`${API_ORIGIN}/v1/content/${kind}/${encodeURIComponent(slug)}`,{headers:{accept:'application/json'}});
  if(!response.ok)return{status:response.status,item:null as Record<string,unknown>|null};
  const data=await response.json() as {item:Record<string,unknown>};return{status:200,item:data.item};
}

export function markdownToSafeHtml(markdown:string){
  const escaped=escapeHtml(markdown.replace(/\r\n?/g,'\n'));
  const blocks=escaped.split(/\n{2,}/).map(block=>block.trim()).filter(Boolean);
  return blocks.map(block=>{
    if(/^###\s+/.test(block))return`<h3>${inline(block.replace(/^###\s+/,''))}</h3>`;
    if(/^##\s+/.test(block))return`<h2>${inline(block.replace(/^##\s+/,''))}</h2>`;
    if(/^#\s+/.test(block))return`<h2>${inline(block.replace(/^#\s+/,''))}</h2>`;
    const lines=block.split('\n');
    if(lines.every(line=>/^[-*]\s+/.test(line)))return`<ul>${lines.map(line=>`<li>${inline(line.replace(/^[-*]\s+/,''))}</li>`).join('')}</ul>`;
    if(lines.every(line=>/^\d+\.\s+/.test(line)))return`<ol>${lines.map(line=>`<li>${inline(line.replace(/^\d+\.\s+/,''))}</li>`).join('')}</ol>`;
    if(/^&gt;\s+/.test(block))return`<blockquote>${inline(block.replace(/^&gt;\s+/,''))}</blockquote>`;
    return`<p>${inline(block).replace(/\n/g,'<br>')}</p>`;
  }).join('');
}
function inline(value:string){return value.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,'<a href="$2" rel="noopener noreferrer">$1</a>');}
function escapeHtml(value:string){return value.replace(/[&<>"']/g,char=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]??char));}
