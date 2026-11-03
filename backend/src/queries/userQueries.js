import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';

export async function findUserByEmail(email) {
  try {
    const response = await client.search({
      index: INDICES.USERS,
      size: 1,
      body: {
        query: {
          bool: {
            filter: [{ term: { 'email.keyword': email.toLowerCase().trim() } }],
          },
        },
        _source: [
          'email',
          'pass',
          'active',
          'firstname',
          'firstName',
          'lastname',
          'lastName',
          'phone',
          'role',
          'orgId',
          'branchId',
          'tags',
          'groupKey',
          'organization',
          'orgName',
          'tokenVersion',
        ],
      },
    });
    const hits = response.body.hits.hits;
    if (!hits.length) return null;
    return { _id: hits[0]._id, ...hits[0]._source };
  } catch (searchErr) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('findUserByEmail failed:', searchErr.message);
      if (searchErr.meta?.body?.error) {
        console.error('OpenSearch:', searchErr.meta.body.error.reason || searchErr.meta.body.error.type);
      }
    }
    throw new Error('Database query failed');
  }
}

export async function findUserById(userId) {
  try {
    const response = await client.get({ index: INDICES.USERS, id: userId });
    if (!response.body.found) return null;
    return { _id: response.body._id, ...response.body._source };
  } catch (error) {
    if (error.meta?.statusCode === 404) return null;
    throw new Error('Database query failed');
  }
}

export async function incrementTokenVersion(userId) {
  try {
    await client.update({
      index: INDICES.USERS,
      id: userId,
      body: {
        script: {
          source:
            'if (ctx._source.tokenVersion == null) { ctx._source.tokenVersion = 1 } else { ctx._source.tokenVersion += 1 }',
          lang: 'painless',
        },
      },
      refresh: true,
    });
  } catch {
    throw new Error('Failed to invalidate tokens');
  }
}
