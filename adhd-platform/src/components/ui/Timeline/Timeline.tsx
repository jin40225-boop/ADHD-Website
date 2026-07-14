export interface TimelineItem { id:string; date:string; title:string; description?:string; }
export interface TimelineProps { /** Progress events, in display order. */ items:TimelineItem[]; }
/** Vertical construction-style progress timeline. */
export function Timeline({items}:TimelineProps){return <ol className="ui-timeline">{items.map(item=><li className="ui-timeline__item" key={item.id}><span className="ui-timeline__dot" aria-hidden="true"/><div className="ui-timeline__date">{item.date}</div><strong>{item.title}</strong>{item.description?<div>{item.description}</div>:null}</li>)}</ol>}
