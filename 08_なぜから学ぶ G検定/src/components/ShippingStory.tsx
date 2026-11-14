import { ShippingIllustration } from "./ShippingIllustration";
import { shippingStory } from "../data/shippingStory";
import { shippingPrediction } from "../engine/shippingStory";

export function ShippingStory({
  sampleAdded,
  onAdd,
  onContinue,
}: {
  sampleAdded: boolean;
  onAdd: () => void;
  onContinue: () => void;
}) {
  const result = shippingPrediction(sampleAdded);
  return (
    <div className="shipping-story">
      <ShippingIllustration label={result.label} sampleAdded={sampleAdded} />
      <div className="shipping-verdicts">
        <span>箱Q／検査員の確認：合格</span>
        <strong>AIの判定：{result.label}</strong>
      </div>
      <blockquote className="inspector-line">
        <span>検査員</span>
        <p>
          「{sampleAdded ? shippingStory.after : shippingStory.before}」
          {!sampleAdded && (
            <>
              <br />
              「そういえば、これによく似た箱も合格だった。あれを見本に加えてみよう」
            </>
          )}
        </p>
      </blockquote>
      {sampleAdded ? (
        <>
          <div className="shipping-discovery" role="status">
            <strong>
              箱Qの判定：{shippingPrediction(false).label} → {result.label}
            </strong>
            <p>{shippingStory.explanation}</p>
          </div>
          <button className="primary story-action" onClick={onContinue}>
            分類を続けて試す →
          </button>
        </>
      ) : (
        <button className="primary story-action" onClick={onAdd}>
          {shippingStory.action}
        </button>
      )}
    </div>
  );
}
