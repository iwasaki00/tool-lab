import { ShippingIllustration } from "./ShippingIllustration";
import { shippingPrologue, shippingTrial } from "../data/shippingStory";
export function ShippingPrologue({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="shipping-story shipping-prologue">
      {shippingPrologue.panels.map((panel, i) => (
        <article className="comic-panel" key={panel.mode}>
          <h2>
            <span>{i + 1}</span>
            {panel.title}
          </h2>
          <ShippingIllustration mode={panel.mode} />
          {"line" in panel ? (
            <blockquote className="inspector-line">
              <span>検査員</span>
              <p>「{panel.line}」</p>
            </blockquote>
          ) : (
            <p className="prologue-narration">{panel.narration}</p>
          )}
        </article>
      ))}
      <button className="primary story-action" onClick={onContinue}>
        {shippingPrologue.action}
      </button>
    </div>
  );
}
export function ShippingTrial({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="shipping-story shipping-trial">
      <ShippingIllustration mode="ai-trial" />
      <blockquote className="inspector-line">
        <span>検査員</span>
        <p>「{shippingTrial.line}」</p>
      </blockquote>
      <button className="primary story-action" onClick={onContinue}>
        {shippingTrial.action}
      </button>
    </div>
  );
}
