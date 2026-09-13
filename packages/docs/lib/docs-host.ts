/**
 * 宿主注入：Prisma 与登录会话由接入方提供，本包不再依赖 @andyyyds/shared。
 */

export type DocsSession = {
  id: string;
};

export type DocsDocumentRow = {
  id: string;
  title: string;
  content: string;
  listScheme: string;
  pageChrome?: string | null;
  updatedAt: Date | string;
  createdAt?: Date | string;
};

export type DocsPrisma = {
  docsDocument: {
    findMany(args: {
      where: { userId: string };
      orderBy: { updatedAt: "desc" };
      take: number;
    }): Promise<DocsDocumentRow[]>;
    findFirst(args: {
      where: { id: string; userId: string };
      select?: { id: true };
    }): Promise<DocsDocumentRow | { id: string } | null>;
    count(args: { where: { userId: string } }): Promise<number>;
    create(args: {
      data: {
        userId: string;
        title: string;
        content: string;
        listScheme: string;
        pageChrome: string;
      };
    }): Promise<DocsDocumentRow>;
    update(args: {
      where: { id: string };
      data: {
        title?: string;
        content?: string;
        listScheme?: string;
        pageChrome?: string;
      };
    }): Promise<DocsDocumentRow>;
    deleteMany(args: { where: { id: string; userId: string } }): Promise<{ count: number }>;
  };
};

let prismaClient: DocsPrisma | null = null;
let getSessionImpl: () => Promise<DocsSession | null> = async () => null;

export function setDocsPrisma(client: DocsPrisma): void {
  prismaClient = client;
}

export function getDocsPrisma(): DocsPrisma {
  if (!prismaClient) {
    throw new Error("文档库未配置。请在宿主应用启动时调用 setDocsPrisma()。");
  }
  return prismaClient;
}

export function setDocsGetSession(fn: () => Promise<DocsSession | null>): void {
  getSessionImpl = fn;
}

export async function getDocsSession(): Promise<DocsSession | null> {
  return getSessionImpl();
}
