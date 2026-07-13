import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { Request } from "express";
import { AuthUser } from "../common/access";
import { PrismaService } from "../prisma/prisma.service";

function cookieValue(req: Request, name: string): string | null {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => cookieValue(req, "auth_token"),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || "change-me-in-production",
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    role: AuthUser["role"];
    did?: string;
  }): Promise<AuthUser> {
    if (payload.did) {
      const device = await this.prisma.userDevice.findUnique({
        where: { id: payload.did },
      });
      if (!device || device.revokedAt) {
        throw new UnauthorizedException("This device has been signed out");
      }
      this.prisma.userDevice
        .update({
          where: { id: payload.did },
          data: { lastSeenAt: new Date() },
        })
        .catch(() => {});
    }
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      deviceRowId: payload.did,
    };
  }
}
