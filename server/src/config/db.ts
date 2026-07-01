import dns from 'dns';
import mongoose from 'mongoose';
import { logger } from './logger';

// Windows DNS resolvers often fail on SRV and TXT lookups needed by mongodb+srv:// URIs.
// We globally patch Node's callback and promise resolver methods to use Google/Cloudflare DNS.
try {
  const cbResolver = new dns.Resolver();
  cbResolver.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  dns.resolveSrv = cbResolver.resolveSrv.bind(cbResolver);
  dns.resolveTxt = cbResolver.resolveTxt.bind(cbResolver);

  const promiseResolver = new dns.promises.Resolver();
  promiseResolver.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  dns.promises.resolveSrv = promiseResolver.resolveSrv.bind(promiseResolver);
  dns.promises.resolveTxt = promiseResolver.resolveTxt.bind(promiseResolver);
  
  logger.info('DNS SRV and TXT resolvers globally patched with public DNS servers');
} catch (e) {
  logger.error('Failed to patch DNS resolvers', { error: String(e) });
}


export async function connectDB(uri: string): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  logger.info('MongoDB connected');
  return mongoose;
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}
