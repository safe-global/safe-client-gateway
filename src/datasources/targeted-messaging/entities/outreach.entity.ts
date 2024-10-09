export class Outreach {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;

  constructor(
    id: number,
    name: string,
    start_date: string,
    end_date: string,
    created_at: string,
    updated_at: string,
  ) {
    this.id = id;
    this.name = name;
    this.start_date = start_date;
    this.end_date = end_date;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }
}
