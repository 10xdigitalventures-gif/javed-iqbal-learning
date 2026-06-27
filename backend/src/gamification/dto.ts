import { IsOptional, IsString } from "class-validator";

export class CheckInDto {
  // The learner's local calendar day (YYYY-MM-DD). Optional; the server day is
  // used as a fallback so the endpoint still works without it.
  @IsOptional() @IsString() day?: string;
}
