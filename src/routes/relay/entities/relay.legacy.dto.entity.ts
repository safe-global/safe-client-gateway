import { RelayLegacyDtoSchema } from "@/routes/relay/entities/schemas/relay.legacy.dto.schema";
import { z } from "zod";

export class RelayLegacyDto implements z.infer<typeof RelayLegacyDtoSchema>{
  chainId!: string;
  to!: `0x${string}`;
  data!: `0x${string}`;
  gasLimit!: string | null;
}
