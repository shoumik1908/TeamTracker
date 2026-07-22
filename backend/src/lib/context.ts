import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  user?: {
    id: string;
    email: string;
    name: string;
    roleId: string;
    teamMemberId: string | null;
    mustChangePassword: boolean;
    permissions: any;
  };
}

export const requestContext = new AsyncLocalStorage<RequestContext>();
