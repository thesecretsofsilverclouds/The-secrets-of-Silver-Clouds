// Measured production-path counters. Acceptance and store/client entry points
// increment these; they are never assigned a hardcoded zero after a run.

export const productionPathSpies = {
  modelCalls: 0,
  requestTimeAuthoring: 0,
  refillReservations: 0,
};

export function resetProductionPathSpies() {
  productionPathSpies.modelCalls = 0;
  productionPathSpies.requestTimeAuthoring = 0;
  productionPathSpies.refillReservations = 0;
}

export function noteModelCall() {
  productionPathSpies.modelCalls += 1;
}

export function noteRequestTimeAuthoring() {
  productionPathSpies.requestTimeAuthoring += 1;
}

export function noteRefillReservation() {
  productionPathSpies.refillReservations += 1;
}

export function readProductionPathSpies() {
  return {
    modelCalls: productionPathSpies.modelCalls,
    requestTimeAuthoring: productionPathSpies.requestTimeAuthoring,
    refillReservations: productionPathSpies.refillReservations,
  };
}
