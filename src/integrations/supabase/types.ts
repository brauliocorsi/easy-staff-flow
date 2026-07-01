export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      absences: {
        Row: {
          absence_date: string
          admin_confirmed: boolean
          auto_detected: boolean
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          days_count: number
          deducted_from_bank: boolean
          employee_id: string
          file_url: string | null
          id: string
          justification_date: string | null
          justification_deadline: string | null
          justified: boolean
          reason: string | null
          type: string
        }
        Insert: {
          absence_date: string
          admin_confirmed?: boolean
          auto_detected?: boolean
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          days_count?: number
          deducted_from_bank?: boolean
          employee_id: string
          file_url?: string | null
          id?: string
          justification_date?: string | null
          justification_deadline?: string | null
          justified?: boolean
          reason?: string | null
          type?: string
        }
        Update: {
          absence_date?: string
          admin_confirmed?: boolean
          auto_detected?: boolean
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          days_count?: number
          deducted_from_bank?: boolean
          employee_id?: string
          file_url?: string | null
          id?: string
          justification_date?: string | null
          justification_deadline?: string | null
          justified?: boolean
          reason?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "absences_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          reference_id: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          reference_id?: string | null
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          reference_id?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      bug_reports: {
        Row: {
          created_at: string
          id: string
          message: string
          page_url: string | null
          resolved: boolean
          status: string
          updated_at: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          page_url?: string | null
          resolved?: boolean
          status?: string
          updated_at?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          page_url?: string | null
          resolved?: boolean
          status?: string
          updated_at?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      contracts: {
        Row: {
          created_at: string
          employee_id: string
          end_date: string | null
          file_url: string | null
          id: string
          is_active: boolean
          notes: string | null
          salary: number | null
          start_date: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          end_date?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          salary?: number | null
          start_date?: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          end_date?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          salary?: number | null
          start_date?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          employee_id: string
          expiry_date: string | null
          file_url: string | null
          id: string
          name: string
          notes: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          name: string
          notes?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          name?: string
          notes?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      early_leave_attempts: {
        Row: {
          actual_attempt_time: string
          attempt_date: string
          attempt_time: string
          confirmed: boolean
          created_at: string
          employee_id: string
          id: string
          minutes_early: number
          scheduled_clock_out: string
          seen_by_admin: boolean
        }
        Insert: {
          actual_attempt_time: string
          attempt_date?: string
          attempt_time?: string
          confirmed?: boolean
          created_at?: string
          employee_id: string
          id?: string
          minutes_early?: number
          scheduled_clock_out: string
          seen_by_admin?: boolean
        }
        Update: {
          actual_attempt_time?: string
          attempt_date?: string
          attempt_time?: string
          confirmed?: boolean
          created_at?: string
          employee_id?: string
          id?: string
          minutes_early?: number
          scheduled_clock_out?: string
          seen_by_admin?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "early_leave_attempts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_evaluations: {
        Row: {
          comments: string | null
          communication_rating: number | null
          completed_at: string | null
          created_at: string
          employee_id: string
          evaluator_id: string
          id: string
          improvements: string | null
          performance_rating: number | null
          punctuality_rating: number | null
          rating: number | null
          requested_by: string
          status: string
          strengths: string | null
          teamwork_rating: number | null
        }
        Insert: {
          comments?: string | null
          communication_rating?: number | null
          completed_at?: string | null
          created_at?: string
          employee_id: string
          evaluator_id: string
          id?: string
          improvements?: string | null
          performance_rating?: number | null
          punctuality_rating?: number | null
          rating?: number | null
          requested_by: string
          status?: string
          strengths?: string | null
          teamwork_rating?: number | null
        }
        Update: {
          comments?: string | null
          communication_rating?: number | null
          completed_at?: string | null
          created_at?: string
          employee_id?: string
          evaluator_id?: string
          id?: string
          improvements?: string | null
          performance_rating?: number | null
          punctuality_rating?: number | null
          rating?: number | null
          requested_by?: string
          status?: string
          strengths?: string | null
          teamwork_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_evaluations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_evaluations_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_schedules: {
        Row: {
          clock_in_time: string
          clock_out_time: string
          created_at: string
          day_of_week: number
          employee_id: string
          id: string
          is_day_off: boolean
          lunch_in_time: string
          lunch_out_time: string
          updated_at: string
        }
        Insert: {
          clock_in_time?: string
          clock_out_time?: string
          created_at?: string
          day_of_week: number
          employee_id: string
          id?: string
          is_day_off?: boolean
          lunch_in_time?: string
          lunch_out_time?: string
          updated_at?: string
        }
        Update: {
          clock_in_time?: string
          clock_out_time?: string
          created_at?: string
          day_of_week?: number
          employee_id?: string
          id?: string
          is_day_off?: boolean
          lunch_in_time?: string
          lunch_out_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_schedules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_suggestions: {
        Row: {
          created_at: string
          employee_id: string | null
          evaluated_leader_id: string | null
          id: string
          is_anonymous: boolean
          message: string
          rating: number | null
          type: string
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          evaluated_leader_id?: string | null
          id?: string
          is_anonymous?: boolean
          message: string
          rating?: number | null
          type?: string
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          evaluated_leader_id?: string | null
          id?: string
          is_anonymous?: boolean
          message?: string
          rating?: number | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_suggestions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_suggestions_evaluated_leader_id_fkey"
            columns: ["evaluated_leader_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_trainings: {
        Row: {
          certificate_url: string | null
          created_at: string
          description: string | null
          employee_id: string
          hours: number
          id: string
          location: string | null
          notes: string | null
          signed_file_url: string | null
          status: string
          title: string
          trainer_id: string | null
          trainer_name: string | null
          training_date: string
          type: string
          updated_at: string
          year: number
        }
        Insert: {
          certificate_url?: string | null
          created_at?: string
          description?: string | null
          employee_id: string
          hours?: number
          id?: string
          location?: string | null
          notes?: string | null
          signed_file_url?: string | null
          status?: string
          title: string
          trainer_id?: string | null
          trainer_name?: string | null
          training_date?: string
          type?: string
          updated_at?: string
          year?: number
        }
        Update: {
          certificate_url?: string | null
          created_at?: string
          description?: string | null
          employee_id?: string
          hours?: number
          id?: string
          location?: string | null
          notes?: string | null
          signed_file_url?: string | null
          status?: string
          title?: string
          trainer_id?: string | null
          trainer_name?: string | null
          training_date?: string
          type?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_trainings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_trainings_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          auto_clock: boolean
          avatar_url: string | null
          birth_date: string | null
          cidade: string | null
          codigo_postal: string | null
          created_at: string
          department_id: string | null
          distrito: string | null
          email: string
          first_name: string
          hire_date: string
          hourly_rate: number | null
          id: string
          last_name: string
          manager_id: string | null
          monthly_salary: number | null
          morada: string | null
          nif: string | null
          niss: string | null
          phone: string | null
          pin_code: string | null
          position: string
          schedule_template_id: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          auto_clock?: boolean
          avatar_url?: string | null
          birth_date?: string | null
          cidade?: string | null
          codigo_postal?: string | null
          created_at?: string
          department_id?: string | null
          distrito?: string | null
          email: string
          first_name: string
          hire_date?: string
          hourly_rate?: number | null
          id?: string
          last_name: string
          manager_id?: string | null
          monthly_salary?: number | null
          morada?: string | null
          nif?: string | null
          niss?: string | null
          phone?: string | null
          pin_code?: string | null
          position?: string
          schedule_template_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          auto_clock?: boolean
          avatar_url?: string | null
          birth_date?: string | null
          cidade?: string | null
          codigo_postal?: string | null
          created_at?: string
          department_id?: string | null
          distrito?: string | null
          email?: string
          first_name?: string
          hire_date?: string
          hourly_rate?: number | null
          id?: string
          last_name?: string
          manager_id?: string | null
          monthly_salary?: number | null
          morada?: string | null
          nif?: string | null
          niss?: string | null
          phone?: string | null
          pin_code?: string | null
          position?: string
          schedule_template_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_schedule_template_id_fkey"
            columns: ["schedule_template_id"]
            isOneToOne: false
            referencedRelation: "schedule_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_deliveries: {
        Row: {
          created_at: string
          delivery_date: string
          employee_id: string
          expiry_date: string | null
          id: string
          item_name: string
          notes: string | null
          quantity: number
          signed_file_url: string | null
          status: string
        }
        Insert: {
          created_at?: string
          delivery_date?: string
          employee_id: string
          expiry_date?: string | null
          id?: string
          item_name: string
          notes?: string | null
          quantity?: number
          signed_file_url?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          delivery_date?: string
          employee_id?: string
          expiry_date?: string | null
          id?: string
          item_name?: string
          notes?: string | null
          quantity?: number
          signed_file_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_deliveries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string
          description: string | null
          holiday_date: string
          id: string
          name: string
          recurring_yearly: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          holiday_date: string
          id?: string
          name: string
          recurring_yearly?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          holiday_date?: string
          id?: string
          name?: string
          recurring_yearly?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      machine_repairs: {
        Row: {
          company_name: string | null
          cost: number | null
          created_at: string
          description: string
          id: string
          invoice_url: string | null
          machine_id: string
          notes: string | null
          parts_replaced: string | null
          repair_date: string
          reported_by: string | null
          resolved_date: string | null
          status: string
          technician_name: string | null
        }
        Insert: {
          company_name?: string | null
          cost?: number | null
          created_at?: string
          description: string
          id?: string
          invoice_url?: string | null
          machine_id: string
          notes?: string | null
          parts_replaced?: string | null
          repair_date?: string
          reported_by?: string | null
          resolved_date?: string | null
          status?: string
          technician_name?: string | null
        }
        Update: {
          company_name?: string | null
          cost?: number | null
          created_at?: string
          description?: string
          id?: string
          invoice_url?: string | null
          machine_id?: string
          notes?: string | null
          parts_replaced?: string | null
          repair_date?: string
          reported_by?: string | null
          resolved_date?: string | null
          status?: string
          technician_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_repairs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_repairs_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          checklist_template: Json
          created_at: string
          description: string | null
          id: string
          location: string | null
          name: string
        }
        Insert: {
          checklist_template?: Json
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          name: string
        }
        Update: {
          checklist_template?: Json
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          name?: string
        }
        Relationships: []
      }
      maintenance_logs: {
        Row: {
          checklist_data: Json
          completed_date: string
          created_at: string
          employee_id: string
          id: string
          machine_id: string
          notes: string | null
          status: string
          task_id: string
        }
        Insert: {
          checklist_data?: Json
          completed_date?: string
          created_at?: string
          employee_id: string
          id?: string
          machine_id: string
          notes?: string | null
          status?: string
          task_id: string
        }
        Update: {
          checklist_data?: Json
          completed_date?: string
          created_at?: string
          employee_id?: string
          id?: string
          machine_id?: string
          notes?: string | null
          status?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_tasks: {
        Row: {
          created_at: string
          day_of_month: number | null
          day_of_week: number | null
          employee_id: string
          frequency: string
          id: string
          is_active: boolean
          machine_id: string
          title: string
        }
        Insert: {
          created_at?: string
          day_of_month?: number | null
          day_of_week?: number | null
          employee_id: string
          frequency?: string
          id?: string
          is_active?: boolean
          machine_id: string
          title: string
        }
        Update: {
          created_at?: string
          day_of_month?: number | null
          day_of_week?: number | null
          employee_id?: string
          frequency?: string
          id?: string
          is_active?: boolean
          machine_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tasks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_exams: {
        Row: {
          created_at: string
          doctor_name: string | null
          employee_id: string
          exam_date: string
          exam_type: string
          file_url: string | null
          id: string
          next_exam_date: string | null
          notes: string | null
          provider: string | null
          result: string
          year: number
        }
        Insert: {
          created_at?: string
          doctor_name?: string | null
          employee_id: string
          exam_date?: string
          exam_type?: string
          file_url?: string | null
          id?: string
          next_exam_date?: string | null
          notes?: string | null
          provider?: string | null
          result?: string
          year?: number
        }
        Update: {
          created_at?: string
          doctor_name?: string | null
          employee_id?: string
          exam_date?: string
          exam_type?: string
          file_url?: string | null
          id?: string
          next_exam_date?: string | null
          notes?: string | null
          provider?: string | null
          result?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "medical_exams_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_agenda_responsibles: {
        Row: {
          agenda_id: string
          created_at: string
          employee_id: string
          id: string
        }
        Insert: {
          agenda_id: string
          created_at?: string
          employee_id: string
          id?: string
        }
        Update: {
          agenda_id?: string
          created_at?: string
          employee_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_agenda_responsibles_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "meeting_agendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_agenda_responsibles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_agendas: {
        Row: {
          created_at: string
          decision: string | null
          description: string | null
          id: string
          meeting_id: string
          responsible_employee_id: string | null
          sort_order: number
          title: string
        }
        Insert: {
          created_at?: string
          decision?: string | null
          description?: string | null
          id?: string
          meeting_id: string
          responsible_employee_id?: string | null
          sort_order?: number
          title: string
        }
        Update: {
          created_at?: string
          decision?: string | null
          description?: string | null
          id?: string
          meeting_id?: string
          responsible_employee_id?: string | null
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_agendas_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_agendas_responsible_employee_id_fkey"
            columns: ["responsible_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_participants: {
        Row: {
          employee_id: string
          id: string
          meeting_id: string
          present: boolean
        }
        Insert: {
          employee_id: string
          id?: string
          meeting_id: string
          present?: boolean
        }
        Update: {
          employee_id?: string
          id?: string
          meeting_id?: string
          present?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_types: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      meetings: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          duration_minutes: number | null
          end_time: string | null
          id: string
          meeting_date: string
          meeting_type: string | null
          paused_at: string | null
          paused_seconds: number
          scheduled_time: string | null
          started_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          meeting_date: string
          meeting_type?: string | null
          paused_at?: string | null
          paused_seconds?: number
          scheduled_time?: string | null
          started_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          meeting_date?: string
          meeting_type?: string | null
          paused_at?: string | null
          paused_seconds?: number
          scheduled_time?: string | null
          started_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      overtime_approvals: {
        Row: {
          actual_clock_in: string | null
          actual_clock_out: string | null
          created_at: string
          decision: string | null
          employee_id: string
          id: string
          kind: string
          minutes: number
          record_date: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scheduled_clock_out: string | null
          status: string
          time_clock_record_id: string | null
          tolerance_applied_minutes: number
          updated_at: string
        }
        Insert: {
          actual_clock_in?: string | null
          actual_clock_out?: string | null
          created_at?: string
          decision?: string | null
          employee_id: string
          id?: string
          kind: string
          minutes: number
          record_date: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_clock_out?: string | null
          status?: string
          time_clock_record_id?: string | null
          tolerance_applied_minutes?: number
          updated_at?: string
        }
        Update: {
          actual_clock_in?: string | null
          actual_clock_out?: string | null
          created_at?: string
          decision?: string | null
          employee_id?: string
          id?: string
          kind?: string
          minutes?: number
          record_date?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_clock_out?: string | null
          status?: string
          time_clock_record_id?: string | null
          tolerance_applied_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "overtime_approvals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          employee_id: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          employee_id?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          employee_id?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_template_days: {
        Row: {
          clock_in_time: string
          clock_out_time: string
          day_of_week: number
          id: string
          is_day_off: boolean
          lunch_in_time: string
          lunch_out_time: string
          template_id: string
        }
        Insert: {
          clock_in_time?: string
          clock_out_time?: string
          day_of_week: number
          id?: string
          is_day_off?: boolean
          lunch_in_time?: string
          lunch_out_time?: string
          template_id: string
        }
        Update: {
          clock_in_time?: string
          clock_out_time?: string
          day_of_week?: number
          id?: string
          is_day_off?: boolean
          lunch_in_time?: string
          lunch_out_time?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_template_days_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "schedule_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          tolerance_early_leave_minutes: number
          tolerance_late_minutes: number
          tolerance_overtime_minutes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tolerance_early_leave_minutes?: number
          tolerance_late_minutes?: number
          tolerance_overtime_minutes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tolerance_early_leave_minutes?: number
          tolerance_late_minutes?: number
          tolerance_overtime_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      time_adjustment_logs: {
        Row: {
          adjustment_type: string
          approved_by: string | null
          created_at: string
          employee_id: string
          field: string
          id: string
          new_value: string | null
          previous_value: string | null
          reason: string
          record_date: string
          requested_by: string | null
          status: string
          time_clock_record_id: string
        }
        Insert: {
          adjustment_type: string
          approved_by?: string | null
          created_at?: string
          employee_id: string
          field: string
          id?: string
          new_value?: string | null
          previous_value?: string | null
          reason: string
          record_date: string
          requested_by?: string | null
          status?: string
          time_clock_record_id: string
        }
        Update: {
          adjustment_type?: string
          approved_by?: string | null
          created_at?: string
          employee_id?: string
          field?: string
          id?: string
          new_value?: string | null
          previous_value?: string | null
          reason?: string
          record_date?: string
          requested_by?: string | null
          status?: string
          time_clock_record_id?: string
        }
        Relationships: []
      }
      time_bank_monthly_closures: {
        Row: {
          approved_credits_minutes: number
          approved_debits_minutes: number
          balance_before_closure_minutes: number
          carried_over_minutes: number
          closed_at: string
          closed_by: string | null
          closing_balance_minutes: number
          closure_decision: string
          closure_notes: string | null
          created_at: string
          employee_id: string
          id: string
          is_locked: boolean
          opening_balance_minutes: number
          paid_minutes: number
          paid_on_closure_minutes: number
          payout_movement_id: string | null
          pending_minutes_at_close: number
          period_month: number
          period_year: number
          rejected_minutes: number
          updated_at: string
        }
        Insert: {
          approved_credits_minutes?: number
          approved_debits_minutes?: number
          balance_before_closure_minutes?: number
          carried_over_minutes?: number
          closed_at?: string
          closed_by?: string | null
          closing_balance_minutes?: number
          closure_decision: string
          closure_notes?: string | null
          created_at?: string
          employee_id: string
          id?: string
          is_locked?: boolean
          opening_balance_minutes?: number
          paid_minutes?: number
          paid_on_closure_minutes?: number
          payout_movement_id?: string | null
          pending_minutes_at_close?: number
          period_month: number
          period_year: number
          rejected_minutes?: number
          updated_at?: string
        }
        Update: {
          approved_credits_minutes?: number
          approved_debits_minutes?: number
          balance_before_closure_minutes?: number
          carried_over_minutes?: number
          closed_at?: string
          closed_by?: string | null
          closing_balance_minutes?: number
          closure_decision?: string
          closure_notes?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          is_locked?: boolean
          opening_balance_minutes?: number
          paid_minutes?: number
          paid_on_closure_minutes?: number
          payout_movement_id?: string | null
          pending_minutes_at_close?: number
          period_month?: number
          period_year?: number
          rejected_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      time_bank_movements: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          decision: string | null
          description: string | null
          effective_minutes: number
          employee_id: string
          id: string
          minutes: number
          movement_type: string
          record_date: string
          source_id: string | null
          source_type: string
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          decision?: string | null
          description?: string | null
          effective_minutes: number
          employee_id: string
          id?: string
          minutes: number
          movement_type: string
          record_date: string
          source_id?: string | null
          source_type: string
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          decision?: string | null
          description?: string | null
          effective_minutes?: number
          employee_id?: string
          id?: string
          minutes?: number
          movement_type?: string
          record_date?: string
          source_id?: string | null
          source_type?: string
          status?: string
        }
        Relationships: []
      }
      time_clock_alarms: {
        Row: {
          alarm_time: string
          created_at: string
          id: string
          is_active: boolean
          label: string
        }
        Insert: {
          alarm_time: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
        }
        Update: {
          alarm_time?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
        }
        Relationships: []
      }
      time_clock_records: {
        Row: {
          approved: boolean | null
          approved_by: string | null
          clock_in: string | null
          clock_out: string | null
          created_at: string
          employee_id: string
          id: string
          lunch_in: string | null
          lunch_out: string | null
          notes: string | null
          record_date: string
          updated_at: string
        }
        Insert: {
          approved?: boolean | null
          approved_by?: string | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          employee_id: string
          id?: string
          lunch_in?: string | null
          lunch_out?: string | null
          notes?: string | null
          record_date?: string
          updated_at?: string
        }
        Update: {
          approved?: boolean | null
          approved_by?: string | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          lunch_in?: string | null
          lunch_out?: string | null
          notes?: string | null
          record_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_clock_records_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_clock_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_assignments: {
        Row: {
          assigned_date: string
          condition: string
          created_at: string
          employee_id: string
          id: string
          notes: string | null
          returned_date: string | null
          serial_number: string | null
          signed_file_url: string | null
          status: string
          tool_name: string
        }
        Insert: {
          assigned_date?: string
          condition?: string
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
          returned_date?: string | null
          serial_number?: string | null
          signed_file_url?: string | null
          status?: string
          tool_name: string
        }
        Update: {
          assigned_date?: string
          condition?: string
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
          returned_date?: string | null
          serial_number?: string | null
          signed_file_url?: string | null
          status?: string
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vacation_requests: {
        Row: {
          admin_confirmed: boolean
          approved_by: string | null
          category: string
          created_at: string
          days_count: number
          employee_confirmed: boolean
          employee_id: string
          end_date: string
          enjoyed: boolean
          id: string
          notes: string | null
          sell_status: string | null
          sold_days: number
          start_date: string
          status: string
          token: string
          total_entitled_days: number
          updated_at: string
          year: number
        }
        Insert: {
          admin_confirmed?: boolean
          approved_by?: string | null
          category?: string
          created_at?: string
          days_count?: number
          employee_confirmed?: boolean
          employee_id: string
          end_date: string
          enjoyed?: boolean
          id?: string
          notes?: string | null
          sell_status?: string | null
          sold_days?: number
          start_date: string
          status?: string
          token?: string
          total_entitled_days?: number
          updated_at?: string
          year?: number
        }
        Update: {
          admin_confirmed?: boolean
          approved_by?: string | null
          category?: string
          created_at?: string
          days_count?: number
          employee_confirmed?: boolean
          employee_id?: string
          end_date?: string
          enjoyed?: boolean
          id?: string
          notes?: string | null
          sell_status?: string | null
          sold_days?: number
          start_date?: string
          status?: string
          token?: string
          total_entitled_days?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "vacation_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      vacation_settings: {
        Row: {
          category: string
          created_at: string
          end_date: string
          id: string
          label: string | null
          notes: string | null
          start_date: string
          year: number
        }
        Insert: {
          category: string
          created_at?: string
          end_date: string
          id?: string
          label?: string | null
          notes?: string | null
          start_date: string
          year: number
        }
        Update: {
          category?: string
          created_at?: string
          end_date?: string
          id?: string
          label?: string | null
          notes?: string | null
          start_date?: string
          year?: number
        }
        Relationships: []
      }
      vehicle_documents: {
        Row: {
          cost: number | null
          created_at: string
          description: string
          expiry_date: string
          file_url: string | null
          id: string
          notes: string | null
          provider: string | null
          reminder_days: number
          start_date: string
          status: string
          type: string
          vehicle_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          description: string
          expiry_date: string
          file_url?: string | null
          id?: string
          notes?: string | null
          provider?: string | null
          reminder_days?: number
          start_date: string
          status?: string
          type?: string
          vehicle_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          description?: string
          expiry_date?: string
          file_url?: string | null
          id?: string
          notes?: string | null
          provider?: string | null
          reminder_days?: number
          start_date?: string
          status?: string
          type?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_inspections: {
        Row: {
          brake_pads: string
          brakes: string
          cleanliness: string
          created_at: string
          dents: string
          employee_id: string
          id: string
          inspection_date: string
          jack: boolean
          km: number
          lights: string
          material_return: string
          observations: string | null
          oil_level: string
          photos: string[] | null
          scratches: string
          tire_condition: string
          turn_signals: string
          vehicle_id: string
          vest: boolean
          water_level: string
          wheel_wrench: boolean
        }
        Insert: {
          brake_pads?: string
          brakes?: string
          cleanliness?: string
          created_at?: string
          dents?: string
          employee_id: string
          id?: string
          inspection_date?: string
          jack?: boolean
          km?: number
          lights?: string
          material_return?: string
          observations?: string | null
          oil_level?: string
          photos?: string[] | null
          scratches?: string
          tire_condition?: string
          turn_signals?: string
          vehicle_id: string
          vest?: boolean
          water_level?: string
          wheel_wrench?: boolean
        }
        Update: {
          brake_pads?: string
          brakes?: string
          cleanliness?: string
          created_at?: string
          dents?: string
          employee_id?: string
          id?: string
          inspection_date?: string
          jack?: boolean
          km?: number
          lights?: string
          material_return?: string
          observations?: string | null
          oil_level?: string
          photos?: string[] | null
          scratches?: string
          tire_condition?: string
          turn_signals?: string
          vehicle_id?: string
          vest?: boolean
          water_level?: string
          wheel_wrench?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_inspections_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_inspections_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_maintenances: {
        Row: {
          cost: number | null
          created_at: string
          description: string
          id: string
          invoice_url: string | null
          km_at_maintenance: number | null
          maintenance_date: string
          next_maintenance_date: string | null
          next_maintenance_km: number | null
          notes: string | null
          parts_replaced: string | null
          performed_by: string | null
          provider: string | null
          status: string
          type: string
          vehicle_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          description: string
          id?: string
          invoice_url?: string | null
          km_at_maintenance?: number | null
          maintenance_date?: string
          next_maintenance_date?: string | null
          next_maintenance_km?: number | null
          notes?: string | null
          parts_replaced?: string | null
          performed_by?: string | null
          provider?: string | null
          status?: string
          type?: string
          vehicle_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          description?: string
          id?: string
          invoice_url?: string | null
          km_at_maintenance?: number | null
          maintenance_date?: string
          next_maintenance_date?: string | null
          next_maintenance_km?: number | null
          notes?: string | null
          parts_replaced?: string | null
          performed_by?: string | null
          provider?: string | null
          status?: string
          type?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_maintenances_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_maintenances_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          assigned_employee_id: string | null
          brand: string | null
          color: string | null
          created_at: string
          fuel_type: string | null
          id: string
          km_current: number | null
          model: string | null
          notes: string | null
          plate: string
          status: string
          vin: string | null
          year: number | null
        }
        Insert: {
          assigned_employee_id?: string | null
          brand?: string | null
          color?: string | null
          created_at?: string
          fuel_type?: string | null
          id?: string
          km_current?: number | null
          model?: string | null
          notes?: string | null
          plate: string
          status?: string
          vin?: string | null
          year?: number | null
        }
        Update: {
          assigned_employee_id?: string | null
          brand?: string | null
          color?: string | null
          created_at?: string
          fuel_type?: string | null
          id?: string
          km_current?: number | null
          model?: string | null
          notes?: string | null
          plate?: string
          status?: string
          vin?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      warnings: {
        Row: {
          created_at: string
          description: string | null
          employee_id: string
          file_url: string | null
          id: string
          issued_by: string | null
          reason: string
          type: string
          warning_date: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          employee_id: string
          file_url?: string | null
          id?: string
          issued_by?: string | null
          reason: string
          type?: string
          warning_date?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          employee_id?: string
          file_url?: string | null
          id?: string
          issued_by?: string | null
          reason?: string
          type?: string
          warning_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "warnings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warnings_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_employee: {
        Args: { _employee_id: string; _viewer_id: string }
        Returns: boolean
      }
      close_time_bank_month: {
        Args: {
          _attendance_debit_minutes?: number
          _decision: string
          _employee_id: string
          _month: number
          _notes?: string
          _paid_minutes?: number
          _year: number
        }
        Returns: Json
      }
      create_opening_balance_snapshot: {
        Args: {
          _cutoff_date: string
          _employee_id: string
          _minutes: number
          _notes: string
        }
        Returns: Json
      }
      get_employee_id_for_user: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_manager_or_admin: { Args: { _user_id: string }; Returns: boolean }
      reopen_time_bank_month: { Args: { _closure_id: string }; Returns: Json }
      review_overtime_approval: {
        Args: { _approval_id: string; _decision: string; _notes: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "employee"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "employee"],
    },
  },
} as const
