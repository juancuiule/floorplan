import type { ReactNode } from 'react'
import type { FurnitureItem, FurnitureType } from '../../../model/decor'
import { Daybed, MurphyBed, PlatformBed } from './Sleep'
import { ButterflyChair, ChairItem, DiningTable, Sofa, StandingDesk } from './SitWork'
import { BlockShelf, Bookshelf, Rug, Sideboard, Wardrobe } from './Storage'
import { FloatingShelf, FruitBaskets, GridShelf, HangingRack, KitchenRail, PegGrid, StationClock, UpperCabinets } from './Wall'

const VIEWS: Record<FurnitureType, (p: { item: FurnitureItem }) => ReactNode> = {
  platformBed: PlatformBed,
  murphyBed: MurphyBed,
  daybed: Daybed,
  sofa: Sofa,
  standingDesk: StandingDesk,
  diningTable: DiningTable,
  chair: ChairItem,
  butterflyChair: ButterflyChair,
  bookshelf: Bookshelf,
  wardrobe: Wardrobe,
  sideboard: Sideboard,
  blockShelf: BlockShelf,
  rug: Rug,
  gridShelf: GridShelf,
  upperCabinets: UpperCabinets,
  floatingShelf: FloatingShelf,
  pegGrid: PegGrid,
  kitchenRail: KitchenRail,
  fruitBaskets: FruitBaskets,
  stationClock: StationClock,
  hangingRack: HangingRack,
}

/** A furniture piece in local space (see FurnitureItem.at for where the origin sits). */
export function Furniture({ item }: { item: FurnitureItem }) {
  const View = VIEWS[item.type]
  return <View item={item} />
}
