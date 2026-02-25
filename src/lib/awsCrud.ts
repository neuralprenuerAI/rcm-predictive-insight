import { awsApi } from "@/integrations/aws/awsApi";

interface CrudResponse<T = any> {
  success: boolean;
  action: string;
  table: string;
  data: T;
  error?: string;
}

export const awsCrud = {
  select: async <T = any>(table: string, filterOrUserId?: Record<string, any> | string, userId?: string): Promise<T[]> => {
    let resolvedFilter: Record<string, any> | undefined;
    let resolvedUserId: string | undefined;

    if (typeof filterOrUserId === 'string') {
      resolvedUserId = filterOrUserId;
    } else {
      resolvedFilter = filterOrUserId;
      resolvedUserId = userId;
    }

    const result = await awsApi.invoke('crud', {
      body: {
        action: 'select',
        table,
        filter: resolvedFilter,
        user_id: resolvedUserId
      }
    });
    if (result.error) throw result.error;
    const response = result.data as CrudResponse<T[]>;
    return response?.data || [];
  },

  insert: async <T = any>(table: string, data: Record<string, any>, userId: string): Promise<CrudResponse<T>> => {
    const result = await awsApi.invoke('crud', {
      body: {
        action: 'insert',
        table,
        data,
        user_id: userId
      }
    });
    if (result.error) throw result.error;
    return result.data;
  },

  update: async <T = any>(table: string, data: Record<string, any>, where: Record<string, any>, userId: string): Promise<CrudResponse<T>> => {
    const result = await awsApi.invoke('crud', {
      body: {
        action: 'update',
        table,
        data,
        where,
        user_id: userId
      }
    });
    if (result.error) throw result.error;
    return result.data;
  },

  upsert: async <T = any>(table: string, data: Record<string, any>, userId: string, onConflict?: string): Promise<CrudResponse<T>> => {
    const result = await awsApi.invoke('crud', {
      body: {
        action: 'upsert',
        table,
        data,
        user_id: userId,
        on_conflict: onConflict
      }
    });
    if (result.error) throw result.error;
    return result.data;
  },

  delete: async <T = any>(table: string, where: Record<string, any>, userId: string): Promise<CrudResponse<T>> => {
    const result = await awsApi.invoke('crud', {
      body: {
        action: 'delete',
        table,
        where,
        user_id: userId
      }
    });
    if (result.error) throw result.error;
    return result.data;
  },

  bulkInsert: async <T = any>(table: string, data: Record<string, any>[], userId: string): Promise<CrudResponse<T>> => {
    const result = await awsApi.invoke('crud', {
      body: {
        action: 'bulk_insert',
        table,
        data,
        user_id: userId
      }
    });
    if (result.error) throw result.error;
    return result.data;
  },

  bulkUpsert: async <T = any>(table: string, data: Record<string, any>[], userId: string, onConflict?: string): Promise<CrudResponse<T>> => {
    const result = await awsApi.invoke('crud', {
      body: {
        action: 'bulk_upsert',
        table,
        data,
        user_id: userId,
        on_conflict: onConflict
      }
    });
    if (result.error) throw result.error;
    return result.data;
  },
};
