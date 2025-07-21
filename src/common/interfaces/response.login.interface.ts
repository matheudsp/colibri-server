

export interface LoginResponse {
  access_token: string;
  projectId?: string;
  user: {
    id: string;
    name: string;
    role: string;
    status: boolean;
  };
}
