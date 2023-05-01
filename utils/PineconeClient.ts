import { PineconeClient as PCClient, QueryRequest } from "@cm-igarashi-ryosuke/pinecone";
import { VectorOperationsApi } from "@cm-igarashi-ryosuke/pinecone/dist/pinecone-generated-ts-fetch";

export class PineconeClient {
	pinecone: PCClient;
	index: VectorOperationsApi | undefined;
	appNamespace = 'app';
	rateLimitIdPrefix = 'rate_limit_';
	dimension: number = 1536;

	constructor() {
		if (!process.env.PINECONE_ENVIRONMENT) {
			throw new Error('Missing Environment Variable PINECONE_ENVIRONMENT')
		}
		if (!process.env.PINECONE_API_KEY) {
			throw new Error('Missing Environment Variable PINECONE_API_KEY')
		}

		this.pinecone = new PCClient();
	}

	public async init() {
		await this.pinecone.init({
			environment: process.env.PINECONE_ENVIRONMENT || '',
			apiKey: process.env.PINECONE_API_KEY || '',
		});

		this.index = this.pinecone.Index("openai");
	}

	public async fetchRateCount(): Promise<number> {
		if (!this.index) {
			throw new Error('index is not initialized');
		}

		const id = this.rateLimitIdPrefix + this.getRateLimitKey();

		const data = await this.index.fetch({
			ids: [id],
			namespace: this.appNamespace,
		});

		if (!data.vectors || !data.vectors[id]) {
			return 0; // まだ登録されていないので0を返す
		}

		const metadata = data.vectors[id]['metadata'] as { count: string };
		if (!metadata || !metadata.count) {
			return Infinity; // 異常なので無限大を返す
		}
		const count = Number(metadata.count);
		return Number.isNaN(count) ? Infinity : count;
	}

	public async upsertRateCount(count: number): Promise<void> {
		if (!this.index) {
			throw new Error('index is not initialized');
		}

		const id = this.rateLimitIdPrefix + this.getRateLimitKey();

		await this.index.upsert({
			upsertRequest: {
				namespace: this.appNamespace,
				vectors: [{
					id: id,
					values: new Array(this.dimension).fill(0), // 0で埋める
					metadata: {
						count: count,
					}
				}]
			},
		});
	}

	public async query(queryRequest: QueryRequest) {
		if (!this.index) {
			throw new Error('index is not initialized');
		}

		const data = await this.index.query({ queryRequest });
		return data;
	}

	private getRateLimitKey(): string {
		const now = new Date();
		const year = now.getFullYear(); // 年を取得(4桁)
		const month = ('0' + (now.getMonth() + 1)).slice(-2); // 月を取得(2桁)
		const date = ('0' + now.getDate()).slice(-2); // 日を取得(2桁)
		const hour = ('0' + now.getHours()).slice(-2); // 時を取得(2桁)
		const minute = ('0' + (Math.floor(now.getMinutes() / 10) * 10)).slice(-2); // 分を10分単位で切り捨てて取得(2桁)
		const yyyymmddhhmm = `${year}${month}${date}${hour}${minute}`; // yyyymmddhhmmを作成

		return yyyymmddhhmm;
	}
}
