import { faker } from "@faker-js/faker";
import { SafeAppProvider } from "../safe-app-provider.entity";

export default function (url?: string, name?: string): SafeAppProvider {
  return <SafeAppProvider>{
    url: url ?? faker.internet.url(),
    name: name ?? faker.random.word(),
  }
}