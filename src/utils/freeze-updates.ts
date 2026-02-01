// Shopify themes don't have React fiber trees to freeze.
// This is a no-op that maintains the interface.
export const freezeUpdates = (): (() => void) => {
  return () => {};
};
