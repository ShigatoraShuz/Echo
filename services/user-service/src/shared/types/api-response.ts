export interface ApiSuccess<T> { success: true; data: T; meta: { requestId: string } }
