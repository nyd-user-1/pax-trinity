import type { Metadata } from "next"

import { mnemonicOf, shortSource } from "../../../audience/audience-data"
import { Dossier } from "./dossier"

type Params = { params: Promise<{ source: string; id: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { source, id } = await params
  return { title: `${mnemonicOf(decodeURIComponent(id))} · ${shortSource(source.toUpperCase())}` }
}

export default async function QuestionDossierPage({ params }: Params) {
  const { source, id } = await params
  return <Dossier source={source} id={decodeURIComponent(id)} />
}
