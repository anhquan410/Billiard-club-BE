import { Injectable, NotFoundException } from '@nestjs/common';
import { TaskStatus } from 'src/prisma';
import { DatabaseService } from 'src/database/database.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';

@Injectable()
export class TaskService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getDashboard(query: TaskQueryDto) {
    const where = query.status ? { status: query.status } : {};

    const tasks = await this.databaseService.staffTask.findMany({
      where,
      include: {
        assignee: { select: { id: true, fullName: true } },
        createdBy: { select: { fullName: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    const allTasks = await this.databaseService.staffTask.findMany({
      select: { status: true, dueDate: true },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const summary = {
      total: allTasks.length,
      todo: allTasks.filter((task) => task.status === TaskStatus.TODO).length,
      inProgress: allTasks.filter((task) => task.status === TaskStatus.IN_PROGRESS).length,
      done: allTasks.filter((task) => task.status === TaskStatus.DONE).length,
      overdue: allTasks.filter((task) => {
        const due = new Date(task.dueDate);
        due.setHours(0, 0, 0, 0);
        return (
          due < today &&
          task.status !== TaskStatus.DONE &&
          task.status !== TaskStatus.CANCELLED
        );
      }).length,
    };

    return {
      summary,
      tasks: tasks.map((task) => this.mapTask(task)),
    };
  }

  async createTask(dto: CreateTaskDto, userId: string) {
    const task = await this.databaseService.staffTask.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        assigneeId: dto.assigneeId,
        createdById: userId,
        dueDate: new Date(`${dto.dueDate}T00:00:00.000Z`),
        tags: dto.tags ?? [],
      },
      include: {
        assignee: { select: { id: true, fullName: true } },
        createdBy: { select: { fullName: true } },
      },
    });

    return this.mapTask(task);
  }

  async updateTaskStatus(id: string, dto: UpdateTaskStatusDto) {
    const existing = await this.databaseService.staffTask.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy công việc');
    }

    const task = await this.databaseService.staffTask.update({
      where: { id },
      data: {
        status: dto.status,
        completedAt: dto.status === TaskStatus.DONE ? new Date() : null,
      },
      include: {
        assignee: { select: { id: true, fullName: true } },
        createdBy: { select: { fullName: true } },
      },
    });

    return this.mapTask(task);
  }

  private mapTask(task: {
    id: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: string;
    assignee: { id: string; fullName: string };
    createdBy: { fullName: string };
    dueDate: Date;
    createdAt: Date;
    completedAt: Date | null;
    tags: string[];
  }) {
    return {
      id: task.id,
      title: task.title,
      description: task.description ?? undefined,
      status: task.status,
      priority: task.priority,
      assigneeId: task.assignee.id,
      assigneeName: task.assignee.fullName,
      createdBy: task.createdBy.fullName,
      dueDate: task.dueDate.toISOString().slice(0, 10),
      createdAt: task.createdAt.toISOString(),
      completedAt: task.completedAt?.toISOString(),
      tags: task.tags,
    };
  }
}
