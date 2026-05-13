declare module 'node-cron' {
  export interface ScheduleOptions {
    name?: string;
    scheduled?: boolean;
    timezone?: string;
    recoverMissedExecutions?: boolean;
  }

  export interface ScheduledTask {
    start(): void;
    stop(): void;
    destroy(): void;
  }

  export function schedule(
    expression: string,
    task: () => void | Promise<void>,
    options?: ScheduleOptions,
  ): ScheduledTask;

  export function validate(expression: string): boolean;

  const cron: {
    schedule: typeof schedule;
    validate: typeof validate;
  };

  export default cron;
}
