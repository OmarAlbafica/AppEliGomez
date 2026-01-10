import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PublicationDashboardComponent } from './publication-dashboard.component';

describe('PublicationDashboardComponent', () => {
  let component: PublicationDashboardComponent;
  let fixture: ComponentFixture<PublicationDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicationDashboardComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PublicationDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});