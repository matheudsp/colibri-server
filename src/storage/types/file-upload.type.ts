export type FileUpload = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

export type StorageResult = {
  url: string;
  key: string;
  metadata: {
    size: number;
    mimetype: string;
    uploadedAt: Date;
  };
};
