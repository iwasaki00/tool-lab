import { ShippingIllustration } from "./ShippingIllustration";
import { shippingPrologue } from "../data/shippingStory";
export function ShippingPrologue({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="shipping-story shipping-prologue">
      <ShippingIllustration mode="prologue" />
      <p className="prologue-narration">{shippingPrologue.narration}</p>
      <blockquote className="inspector-line">
        <span>検査員</span>
        <p>「{shippingPrologue.line}」</p>
      </blockquote>
      <button className="primary story-action" onClick={onContinue}>
        {shippingPrologue.action}
      </button>
    </div>
  );
}
