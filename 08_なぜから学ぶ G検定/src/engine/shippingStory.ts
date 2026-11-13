import { classify, samples } from "./simulations";
import { inspectedSample, shippingTarget } from "../data/shippingStory";

export function shippingPrediction(sampleAdded: boolean) {
  return classify(
    sampleAdded ? [...samples, inspectedSample] : samples,
    shippingTarget,
  );
}
