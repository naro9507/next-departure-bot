import timeTableData from './data/timeTable.json'

interface TimeTableRepository {
 getNextFromBusStop1(): Date
 getNextFromBusStop2(): Date
}

type TimeTable = {
  hour: number
  minutes: ReadonlyArray<number>
}

export class TimeTableRepositoryImpl implements TimeTableRepository {
  busStop1 : ReadonlyArray<TimeTable>
  busStop2: ReadonlyArray<TimeTable>

  constructor() {
    this.busStop1 = timeTableData.busStop1
    this.busStop2 = timeTableData.busStop2
  }

  public getNextFromBusStop1(): Date {
    return new Date()
  }

  public getNextFromBusStop2(): Date {
    return new Date()
  }
}
