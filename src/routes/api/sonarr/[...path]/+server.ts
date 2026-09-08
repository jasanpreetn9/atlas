import { getSonarrConfig } from '$lib/server/config';
import { proxyArr } from '$lib/server/proxy';
import type { RequestHandler } from './$types';

const handler: RequestHandler = (event) => proxyArr('sonarr', getSonarrConfig(), event);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
