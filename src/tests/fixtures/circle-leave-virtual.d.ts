declare module 'virtual:leave-client' {
  export const fixture: {
    id: string;
    user: { id: string; email: string };
    status: string;
    members: number;
  };
  export function card(): any;
}
