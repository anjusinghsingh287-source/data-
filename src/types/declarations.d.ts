declare module '@addmaple/parquet-lite/writer' {
  export function writeParquet(
    schema: Array<{
      name: string;
      type: 'int32' | 'int64' | 'float' | 'double' | 'boolean' | 'string';
      nullable?: boolean;
    }>,
    data: Record<string, any[] | Int32Array | Float64Array>,
    config?: {
      compression?: 'snappy' | 'none';
      rowGroupSize?: number;
      version?: 'v1' | 'v2';
    }
  ): Promise<Uint8Array>;

  export function initWriter(source?: any): Promise<void>;
}
