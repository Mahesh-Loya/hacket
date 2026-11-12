import type { Data } from "./projects";

export function mountPicker(el: HTMLElement, _data: Data, _onSubmitted: () => void) {
  el.textContent = "Wallet sign-in arrives in the next step.";
}
