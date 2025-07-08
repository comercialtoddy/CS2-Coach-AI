import { cpus, freemem, totalmem } from 'os';
import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ProcessUsage {
  cpu: number;
  memory: number;
  ppid?: number;
  pid: number;
  ctime: number;
  elapsed: number;
  timestamp: number;
}

interface ProcessInfo {
  pid: number;
  name: string;
  startTime: number;
}

interface ResourceUsage {
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    free: number;
    total: number;
    percentage: number;
  };
  disk?: {
    free: number;
    total: number;
    percentage: number;
  };
}

interface ResourceManagerConfig {
  monitoringInterval: number; // in milliseconds
  thresholds: {
    cpu: number; // percentage
    memory: number; // percentage
    disk: number; // percentage
  };
  autoKillEnabled: boolean;
}

export enum ResourceManagerEvent {
  RESOURCE_WARNING = 'resource-warning',
  RESOURCE_CRITICAL = 'resource-critical',
  PROCESS_ERROR = 'process-error'
}

/**
 * Resource Manager class for monitoring system resources and managing processes
 */
export class ResourceManager extends EventEmitter {
  private static instance: ResourceManager;
  private config: ResourceManagerConfig;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private processes: Map<number, ProcessInfo> = new Map();

  private constructor() {
    super();
    this.config = {
      monitoringInterval: 1000,
      thresholds: {
        cpu: 80,
        memory: 80,
        disk: 90
      },
      autoKillEnabled: true
    };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager();
    }
    return ResourceManager.instance;
  }

  /**
   * Configure resource manager
   */
  public configure(config: Partial<ResourceManagerConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      thresholds: {
        ...this.config.thresholds,
        ...config.thresholds
      }
    };
  }

  /**
   * Start resource monitoring
   */
  public startMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        const usage = await this.getResourceUsage();

        // Check CPU usage
        if (usage.cpu.usage > this.config.thresholds.cpu) {
          this.emit(ResourceManagerEvent.RESOURCE_WARNING, {
            resource: 'cpu',
            usage: usage.cpu.usage
          });

          if (usage.cpu.usage > this.config.thresholds.cpu + 10) {
            this.emit(ResourceManagerEvent.RESOURCE_CRITICAL, {
              resource: 'cpu',
              usage: usage.cpu.usage
            });

            if (this.config.autoKillEnabled) {
              await this.killHighestCPUProcess();
            }
          }
        }

        // Check memory usage
        if (usage.memory.percentage > this.config.thresholds.memory) {
          this.emit(ResourceManagerEvent.RESOURCE_WARNING, {
            resource: 'memory',
            usage: usage.memory.percentage
          });

          if (usage.memory.percentage > this.config.thresholds.memory + 10) {
            this.emit(ResourceManagerEvent.RESOURCE_CRITICAL, {
              resource: 'memory',
              usage: usage.memory.percentage
            });

            if (this.config.autoKillEnabled) {
              await this.killOldestProcess();
            }
          }
        }

        // Check disk usage if available
        if (usage.disk && usage.disk.percentage > this.config.thresholds.disk) {
          this.emit(ResourceManagerEvent.RESOURCE_WARNING, {
            resource: 'disk',
            usage: usage.disk.percentage
          });

          if (usage.disk.percentage > this.config.thresholds.disk + 5) {
            this.emit(ResourceManagerEvent.RESOURCE_CRITICAL, {
              resource: 'disk',
              usage: usage.disk.percentage
            });
          }
        }

      } catch (error) {
        console.error('Resource monitoring error:', error);
      }
    }, this.config.monitoringInterval);
  }

  /**
   * Stop resource monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Get current resource usage
   */
  public async getResourceUsage(): Promise<ResourceUsage> {
    const cpuInfo = cpus();
    const memTotal = totalmem();
    const memFree = freemem();
    const memUsed = memTotal - memFree;
    const memPercentage = (memUsed / memTotal) * 100;

    // Calculate CPU usage
    let cpuUsage = 0;
    if (this.processes.size > 0) {
      const usages = await Promise.all(
        Array.from(this.processes.keys()).map(pid =>
          this.getProcessUsage(pid).catch(() => null)
        )
      );

      const validUsages = usages.filter((usage): usage is ProcessUsage => usage !== null);
      if (validUsages.length > 0) {
        cpuUsage = validUsages.reduce((sum, usage) => sum + usage.cpu, 0);
      }
    }

    // Get disk usage (platform specific)
    let diskUsage;
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync('wmic logicaldisk get size,freespace,caption');
        // Parse Windows disk info
        diskUsage = this.parseWindowsDiskInfo(stdout);
      } else {
        const { stdout } = await execAsync('df -h /');
        // Parse Unix disk info
        diskUsage = this.parseUnixDiskInfo(stdout);
      }
    } catch (error) {
      console.error('Failed to get disk usage:', error);
    }

    return {
      cpu: {
        usage: cpuUsage,
        cores: cpuInfo.length
      },
      memory: {
        free: memFree,
        total: memTotal,
        percentage: memPercentage
      },
      ...(diskUsage && { disk: diskUsage })
    };
  }

  /**
   * Get process usage information
   */
  private async getProcessUsage(pid: number): Promise<ProcessUsage> {
    return new Promise((resolve, reject) => {
      exec(`ps -p ${pid} -o %cpu,%mem`, (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }

        const lines = stdout.trim().split('\n');
        if (lines.length < 2) {
          reject(new Error('Process not found'));
          return;
        }

        const [cpu, memory] = lines[1].trim().split(/\s+/).map(Number);
        resolve({
          cpu,
          memory,
          pid,
          ppid: undefined,
          ctime: 0,
          elapsed: 0,
          timestamp: Date.now()
        });
      });
    });
  }

  /**
   * Register a process for monitoring
   */
  public registerProcess(pid: number, name: string): void {
    this.processes.set(pid, {
      pid,
      name,
      startTime: Date.now()
    });
  }

  /**
   * Unregister a process from monitoring
   */
  public unregisterProcess(pid: number): void {
    this.processes.delete(pid);
  }

  /**
   * Report a process error
   */
  public reportProcessError(pid: number, error: Error): void {
    const process = this.processes.get(pid);
    if (process) {
      this.emit(ResourceManagerEvent.PROCESS_ERROR, {
        pid,
        name: process.name,
        error: error.message
      });
    }
  }

  /**
   * Kill a specific process
   */
  public async killProcess(pid: number): Promise<void> {
    try {
      if (process.platform === 'win32') {
        await execAsync(`taskkill /PID ${pid} /F`);
      } else {
        await execAsync(`kill -9 ${pid}`);
      }
      this.unregisterProcess(pid);
    } catch (error) {
      console.error(`Failed to kill process ${pid}:`, error);
    }
  }

  /**
   * Kill the process using the most CPU
   */
  private async killHighestCPUProcess(): Promise<void> {
    try {
      const usages = await Promise.all(
        Array.from(this.processes.keys()).map(async pid => {
          try {
            const usage = await this.getProcessUsage(pid);
            return { pid, cpu: usage.cpu };
          } catch {
            return null;
          }
        })
      );

      const highestCPU = usages
        .filter((usage): usage is { pid: number; cpu: number } => usage !== null)
        .sort((a, b) => b.cpu - a.cpu)[0];

      if (highestCPU) {
        await this.killProcess(highestCPU.pid);
      }
    } catch (error) {
      console.error('Failed to kill highest CPU process:', error);
    }
  }

  /**
   * Kill the oldest registered process
   */
  private async killOldestProcess(): Promise<void> {
    const processes = Array.from(this.processes.values());
    if (processes.length > 0) {
      const oldest = processes.sort((a, b) => a.startTime - b.startTime)[0];
      await this.killProcess(oldest.pid);
    }
  }

  /**
   * Parse Windows disk info
   */
  private parseWindowsDiskInfo(stdout: string): { free: number; total: number; percentage: number } | undefined {
    try {
      const lines = stdout.trim().split('\n');
      if (lines.length < 2) return undefined;

      const values = lines[1].trim().split(/\s+/);
      if (values.length < 3) return undefined;

      const free = parseInt(values[1]);
      const total = parseInt(values[0]);
      const used = total - free;
      const percentage = (used / total) * 100;

      return {
        free,
        total,
        percentage
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Parse Unix disk info
   */
  private parseUnixDiskInfo(stdout: string): { free: number; total: number; percentage: number } | undefined {
    try {
      const lines = stdout.trim().split('\n');
      if (lines.length < 2) return undefined;

      const values = lines[1].trim().split(/\s+/);
      if (values.length < 5) return undefined;

      const total = parseInt(values[1].replace('G', '')) * 1024 * 1024 * 1024;
      const used = parseInt(values[2].replace('G', '')) * 1024 * 1024 * 1024;
      const free = parseInt(values[3].replace('G', '')) * 1024 * 1024 * 1024;
      const percentage = parseInt(values[4].replace('%', ''));

      return {
        free,
        total,
        percentage
      };
    } catch {
      return undefined;
    }
  }
} 