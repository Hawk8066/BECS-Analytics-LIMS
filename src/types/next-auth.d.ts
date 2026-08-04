import type { Designation, UserStatus } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      designation: Designation;
      status: UserStatus;
      facilityId: string;
      sectionId: string;
      clientId: string | null;
      vendorId: string | null;
      outsourceLabId: string | null;
      roleKeys: string[];
      canReadCrossSection: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    designation?: Designation;
    status?: UserStatus;
    facilityId?: string;
    sectionId?: string;
    clientId?: string | null;
    vendorId?: string | null;
    outsourceLabId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    designation?: Designation;
    status?: UserStatus;
    facilityId?: string;
    sectionId?: string;
    clientId?: string | null;
    vendorId?: string | null;
    outsourceLabId?: string | null;
  }
}
