export const QueueReadiness = Symbol('IQueueReadiness');

export interface IQueueReadiness {
  /**
   * Checks if the configured queue consumer is connected.
   */
  isReady(): boolean;
}
