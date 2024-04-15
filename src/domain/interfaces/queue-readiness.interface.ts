export const QueueReadiness = Symbol('IQueueReadiness');

export interface IQueueReadiness {
  /**
   * Checks if the configured queue consumer is connected.
   *
   * @returns true if the underlying queue consumer is connected to the AMQP server.
   */
  isReady(): boolean;
}
