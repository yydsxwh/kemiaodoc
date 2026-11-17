import type {NextConfig} from "next";
import {securityHeaders} from "@andyyyds/shared/security/headers";
const config:NextConfig={transpilePackages:["@yydsxwh/shared","@andyyyds/docs","@andyyyds/shared","@andyyyds/decorate"],async headers(){return [{source:"/:path*",headers:securityHeaders()}];}};
export default config;
