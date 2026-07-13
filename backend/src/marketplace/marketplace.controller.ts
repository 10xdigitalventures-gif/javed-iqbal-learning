import { Controller, Get } from "@nestjs/common";
import { MarketplaceService } from "./marketplace.service";

// PUBLIC global marketplace endpoints (no auth). These aggregate content from
// every listed tenant so the main marketplace shows "saare consultants + saara
// content" in one place — dedicated-portal tenants included (dual presence).
@Controller("marketplace")
export class MarketplaceController {
  constructor(private service: MarketplaceService) {}

  // Combined catalog consumed by the marketplace home page.
  @Get("catalog")
  catalog() {
    return this.service.catalog();
  }

  @Get("experts")
  experts() {
    return this.service.experts();
  }

  @Get("books")
  books() {
    return this.service.books();
  }

  @Get("courses")
  courses() {
    return this.service.courses();
  }

  @Get("packages")
  packages() {
    return this.service.packages();
  }
}
