import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, from, of } from "rxjs";
import { switchMap, tap } from "rxjs/operators";
import { Reflector } from "@nestjs/core";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { createHash } from "crypto";
import { IdempotencyKey } from "../entities/idempotency-key.entity";

export const IDEMPOTENT_KEY = "isIdempotent";

export function Idempotent() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata(IDEMPOTENT_KEY, true, descriptor.value);
    return descriptor;
  };
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly repo: Repository<IdempotencyKey>,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isIdempotent = this.reflector.get<boolean>(IDEMPOTENT_KEY, context.getHandler());
    if (!isIdempotent) return next.handle();

    const request = context.switchToHttp().getRequest();
    const key = request.headers["idempotency-key"];
    const userId = request.user?.id;

    if (!key || typeof key !== "string") {
      throw new ConflictException("Idempotency-Key header required");
    }
    if (key.length < 16 || key.length > 128) {
      throw new ConflictException("Idempotency-Key must be 16-128 characters");
    }
    if (!userId) return next.handle();

    const requestHash = createHash("sha256")
      .update(JSON.stringify({ url: request.url, body: request.body }))
      .digest("hex");

    return from(this.repo.findOne({ where: { key, userId } })).pipe(
      switchMap((existing) => {
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new ConflictException("Idempotency key reused with different payload");
          }
          return of(JSON.parse(existing.responseBody));
        }
        return next.handle().pipe(
          tap(async (response) => {
            await this.repo.insert({
              key,
              userId,
              requestHash,
              responseBody: JSON.stringify(response),
            });
          }),
        );
      }),
    );
  }
}
