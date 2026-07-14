import type { CSSProperties } from 'react';
export interface StepFlowItem { title:string; description?:string; }
export interface StepFlowProps { /** Ordered steps in the process. */ steps:StepFlowItem[]; }
/** Responsive numbered process flow, horizontal on desktop and vertical on mobile. */
export function StepFlow({steps}:StepFlowProps){return <ol className="ui-step-flow" style={{'--step-count':steps.length} as CSSProperties}>{steps.map((step,index)=><li className="ui-step" key={step.title}><span className="ui-step__number">{index+1}</span><span><strong>{step.title}</strong>{step.description?<small style={{display:'block'}}>{step.description}</small>:null}</span></li>)}</ol>}
