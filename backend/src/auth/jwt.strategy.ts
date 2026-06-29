import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AuthUser } from "../common/access";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
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
    // Concurrent device enforcement: if the token carries a device id, that
    // device must still be active. A device that was kicked by the limit (or
    // signed out remotely) has revokedAt set -> reject so it logs out.
    if (payload.did) {
      const device = await this.prisma.userDevice.findUnique({
        where: { id: payload.did },
      });
      if (!device || device.revokedAt) {
        throw new UnauthorizedException("This device has been signed out");
      }
      // Touch lastSeenAt occasionally (best-effort, non-blocking).
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
