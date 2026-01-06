export function getUserId(req: any): string {
  const userId = req.user?.sub || req.user?.id;
  if (!userId) {
    throw new Error('User ID not found in JWT token');
  }
  return userId;
}
