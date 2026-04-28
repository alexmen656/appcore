import { EventEmitter } from "events";

export interface JobLogBuffer {
  logs: string[];
  done: boolean;
  emitter: EventEmitter;
}

const activeJobs = new Map<string, JobLogBuffer>();

export function createJobLogEmitter(jobId: string): {
  emit: (line: string) => void;
  finish: () => void;
} {
  const buffer: JobLogBuffer = {
    logs: [],
    done: false,
    emitter: new EventEmitter(),
  };
  buffer.emitter.setMaxListeners(50);
  activeJobs.set(jobId, buffer);

  return {
    emit(line: string) {
      buffer.logs.push(line);
      buffer.emitter.emit("line", line);
    },
    finish() {
      buffer.done = true;
      buffer.emitter.emit("done");
      setTimeout(() => activeJobs.delete(jobId), 60_000);
    },
  };
}

export function getJobLogBuffer(jobId: string): JobLogBuffer | undefined {
  return activeJobs.get(jobId);
}
